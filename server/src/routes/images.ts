import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { db } from '../config/database';
import { minioClient, BUCKET, getSignedUrl, deleteObject } from '../config/storage';
import { requireAuth, requireAdmin, optionalAuth, AuthRequest } from '../middlewares/auth';
import { scanFile } from '../services/clamav';
import { logger } from '../utils/logger';
import rateLimit from 'express-rate-limit';

export const imagesRouter = Router();

const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE = parseFileSizeEnv(process.env.MAX_FILE_SIZE || '50MB');

function parseFileSizeEnv(size: string): number {
  const match = size.match(/^(\d+)(MB|KB|GB)?$/i);
  if (!match) return 50 * 1024 * 1024;
  const [, num, unit = 'MB'] = match;
  const multipliers: Record<string, number> = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return parseInt(num) * (multipliers[unit.toUpperCase()] || 1024 ** 2);
}

/**
 * Detect real image type from magic bytes in the file header.
 * iPhones sometimes send HEIC as "application/octet-stream" or with wrong MIME type.
 * We check the actual bytes so we never rely on what the browser claims.
 */
function detectMimeFromBuffer(buffer: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  // WEBP: RIFF????WEBP
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  // HEIC/HEIF: ftyp box at bytes 4-7, brand at bytes 8-11
  if (buffer.length >= 12) {
    const ftyp = buffer.slice(4, 8).toString('ascii');
    const brand = buffer.slice(8, 12).toString('ascii');
    if (ftyp === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)/.test(brand)) {
      return 'image/heic';
    }
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    // Accept allowed types AND octet-stream (iPhones sometimes send this for HEIC)
    // Real type is verified from magic bytes after upload in the route handler
    const declared = file.mimetype;
    if (ALLOWED_MIME_TYPES.includes(declared) || declared === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${declared}`));
    }
  },
});

// GET /images - list all images
imagesRouter.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
  const offset = (page - 1) * limit;
  const sort = req.query.sort === 'likes' ? 'likes' : 'newest';

  let query: string;
  if (sort === 'likes') {
    query = `
      SELECT i.*, COUNT(l.id) as like_count,
        ${req.user ? `EXISTS(SELECT 1 FROM likes WHERE image_id = i.id AND user_id = $3) as user_liked` : 'FALSE as user_liked'}
      FROM images i
      LEFT JOIN likes l ON l.image_id = i.id
      WHERE i.is_deleted = FALSE AND i.is_flagged = FALSE AND i.scan_status != 'infected'
      GROUP BY i.id
      ORDER BY like_count DESC, i.created_at DESC
      LIMIT $1 OFFSET $2
    `;
  } else {
    query = `
      SELECT i.*, COUNT(l.id) as like_count,
        ${req.user ? `EXISTS(SELECT 1 FROM likes WHERE image_id = i.id AND user_id = $3) as user_liked` : 'FALSE as user_liked'}
      FROM images i
      LEFT JOIN likes l ON l.image_id = i.id
      WHERE i.is_deleted = FALSE AND i.is_flagged = FALSE AND i.scan_status != 'infected'
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT $1 OFFSET $2
    `;
  }

  const params: (string | number)[] = [limit, offset];
  if (req.user) params.push(req.user.id);

  const result = await db.query(query, params);
  const countResult = await db.query(
    `SELECT COUNT(*) FROM images WHERE is_deleted = FALSE AND is_flagged = FALSE AND scan_status != 'infected'`
  );
  const total = parseInt(countResult.rows[0].count);

  // Add signed URLs
  const images = await Promise.all(
    result.rows.map(async (img) => ({
      ...img,
      url: await getSignedUrl(img.storage_path),
      thumbnail_url: img.thumbnail_path ? await getSignedUrl(img.thumbnail_path) : null,
    }))
  );

  res.json({
    images,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /images/top - top 10 by likes
imagesRouter.get('/top', optionalAuth, async (req: AuthRequest, res: Response) => {
  const result = await db.query(`
    SELECT i.*, COUNT(l.id) as like_count,
      ${req.user ? `EXISTS(SELECT 1 FROM likes WHERE image_id = i.id AND user_id = $1) as user_liked` : 'FALSE as user_liked'}
    FROM images i
    LEFT JOIN likes l ON l.image_id = i.id
    WHERE i.is_deleted = FALSE AND i.is_flagged = FALSE AND i.scan_status != 'infected'
    GROUP BY i.id
    ORDER BY like_count DESC, i.created_at DESC
    LIMIT 10
  `, req.user ? [req.user.id] : []);

  const images = await Promise.all(
    result.rows.map(async (img) => ({
      ...img,
      url: await getSignedUrl(img.storage_path),
      thumbnail_url: img.thumbnail_path ? await getSignedUrl(img.thumbnail_path) : null,
    }))
  );

  res.json({ images });
});

// GET /images/:id - single image
imagesRouter.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const result = await db.query(`
    SELECT i.*, COUNT(l.id) as like_count,
      ${req.user ? `EXISTS(SELECT 1 FROM likes WHERE image_id = i.id AND user_id = $2) as user_liked` : 'FALSE as user_liked'}
    FROM images i
    LEFT JOIN likes l ON l.image_id = i.id
    WHERE i.id = $1 AND i.is_deleted = FALSE
    GROUP BY i.id
  `, req.user ? [req.params.id, req.user.id] : [req.params.id]);

  if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found' });

  const img = result.rows[0];
  res.json({
    ...img,
    url: await getSignedUrl(img.storage_path),
    thumbnail_url: img.thumbnail_path ? await getSignedUrl(img.thumbnail_path) : null,
    download_url: await getSignedUrl(img.storage_path, 300),
  });
});

// POST /images/upload - upload image
imagesRouter.post('/upload', requireAuth, uploadLimiter, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const file = req.file;
  const imageId = uuidv4();
  let buffer = file.buffer;

  // Always detect MIME from magic bytes – never trust what the browser sent.
  // This is the fix that makes iPhone HEIC uploads work reliably:
  // Safari sometimes sends HEIC files as "application/octet-stream".
  const detectedMime = detectMimeFromBuffer(buffer);
  if (!detectedMime) {
    return res.status(400).json({ error: 'Could not identify image type. Please upload a JPG, PNG, WEBP or HEIC file.' });
  }
  let mimeType = detectedMime;

  // Convert HEIC/HEIF to JPEG (Sharp handles the actual decoding via libvips-heif)
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    logger.info(`Converting HEIC → JPEG for upload ${imageId}`);
    buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    mimeType = 'image/jpeg';
  }

  // Generate thumbnail
  const thumbnailBuffer = await sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `originals/${imageId}.${ext}`;
  const thumbnailPath = `thumbnails/${imageId}.webp`;

  // Upload to MinIO
  await minioClient.putObject(BUCKET, storagePath, buffer, buffer.length, { 'Content-Type': mimeType });
  await minioClient.putObject(BUCKET, thumbnailPath, thumbnailBuffer, thumbnailBuffer.length, { 'Content-Type': 'image/webp' });

  // Save to DB
  const result = await db.query(`
    INSERT INTO images (id, filename, original_filename, storage_path, thumbnail_path, mime_type, size_bytes, uploaded_by, scan_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING *
  `, [imageId, `${imageId}.${ext}`, file.originalname, storagePath, thumbnailPath, mimeType, buffer.length, req.user!.id]);

  const image = result.rows[0];

  // Run ClamAV scan in background
  scanFile(buffer, imageId).catch(err => logger.error('Scan error', err));

  res.status(201).json({
    ...image,
    url: await getSignedUrl(storagePath),
    thumbnail_url: await getSignedUrl(thumbnailPath),
  });
});

// DELETE /images/:id - admin only
imagesRouter.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const result = await db.query('SELECT * FROM images WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found' });

  const image = result.rows[0];

  // Delete from storage
  try {
    await deleteObject(image.storage_path);
    if (image.thumbnail_path) await deleteObject(image.thumbnail_path);
  } catch (err) {
    logger.warn('Could not delete from storage', err);
  }

  await db.query('UPDATE images SET is_deleted = TRUE WHERE id = $1', [req.params.id]);
  res.json({ message: 'Image deleted' });
});
