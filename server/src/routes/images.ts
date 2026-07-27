import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { db } from '../config/database';
import { minioClient, BUCKET, deleteObject, getObject } from '../config/storage';
import { requireAuth, requireAdmin, optionalAuth, AuthRequest } from '../middlewares/auth';
import { scanBuffer } from '../services/clamav';
import { logger } from '../utils/logger';
import rateLimit from 'express-rate-limit';

export const imagesRouter = Router();

const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

const ALLOWED_MIME = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
const MAX_SIZE = parseSize(process.env.MAX_FILE_SIZE || '50MB');

function parseSize(s: string): number {
  const m = s.match(/^(\d+)(MB|KB|GB)?$/i);
  if (!m) return 50 * 1024 * 1024;
  const units: Record<string,number> = { KB: 1024, MB: 1024**2, GB: 1024**3 };
  return parseInt(m[1]) * (units[(m[2]||'MB').toUpperCase()] || 1024**2);
}

function detectMime(buf: Buffer): string | null {
  if (buf[0]===0xff && buf[1]===0xd8 && buf[2]===0xff) return 'image/jpeg';
  if (buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4e && buf[3]===0x47) return 'image/png';
  if (buf.slice(0,4).toString()==='RIFF' && buf.slice(8,12).toString()==='WEBP') return 'image/webp';
  if (buf.length >= 12) {
    const ftyp = buf.slice(4,8).toString('ascii');
    const brand = buf.slice(8,12).toString('ascii');
    if (ftyp==='ftyp' && /^(heic|heix|hevc|mif1|msf1)/.test(brand)) return 'image/heic';
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype) || file.mimetype === 'application/octet-stream')
      cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

async function addUrls(img: any) {
  return {
    ...img,

    // Bild anzeigen
    url: `/images/${img.id}/file`,

    // kleines Bild für Galerie
    thumbnail_url: img.thumbnail_path
      ? `/images/${img.id}/thumb`
      : null,

    // Download
    download_url: `/images/${img.id}/download`,
  };
}

// GET /images
imagesRouter.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  const page  = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
  const sort  = req.query.sort === 'likes' ? 'likes' : 'newest';
  const offset = (page - 1) * limit;
  const uid = req.user?.id || null;

  const orderBy = sort === 'likes' ? 'like_count DESC, i.created_at DESC' : 'i.created_at DESC';

  const result = await db.query(`
    SELECT i.*, COUNT(l.id)::int AS like_count,
      ${uid ? 'EXISTS(SELECT 1 FROM likes WHERE image_id=i.id AND user_id=$3)' : 'FALSE'} AS user_liked
    FROM images i LEFT JOIN likes l ON l.image_id=i.id
    WHERE i.is_deleted=FALSE AND i.is_flagged=FALSE AND i.scan_status!='infected'
    GROUP BY i.id ORDER BY ${orderBy} LIMIT $1 OFFSET $2
  `, uid ? [limit, offset, uid] : [limit, offset]);

  const total = (await db.query(
    "SELECT COUNT(*)::int FROM images WHERE is_deleted=FALSE AND is_flagged=FALSE AND scan_status!='infected'"
  )).rows[0].count;

  const images = await Promise.all(result.rows.map(addUrls));
  res.json({ images, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// GET /images/top
imagesRouter.get('/top', optionalAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.user?.id || null;
  const result = await db.query(`
    SELECT i.*, COUNT(l.id)::int AS like_count,
      ${uid ? 'EXISTS(SELECT 1 FROM likes WHERE image_id=i.id AND user_id=$1)' : 'FALSE'} AS user_liked
    FROM images i LEFT JOIN likes l ON l.image_id=i.id
    WHERE i.is_deleted=FALSE AND i.is_flagged=FALSE AND i.scan_status!='infected'
    GROUP BY i.id ORDER BY like_count DESC, i.created_at DESC LIMIT 10
  `, uid ? [uid] : []);

  const images = await Promise.all(result.rows.map(addUrls));
  res.json({ images });
});

// POST /images/upload
imagesRouter.post('/upload', requireAuth, uploadLimiter, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  let buffer = req.file.buffer;
  const mime = detectMime(buffer);
  if (!mime) return res.status(400).json({ error: 'Unrecognized image format' });

  let mimeType = mime;

  // Convert HEIC → JPEG
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    mimeType = 'image/jpeg';
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const id  = uuidv4();
  const storagePath   = `originals/${id}.${ext}`;
  const thumbnailPath = `thumbnails/${id}.webp`;

  const thumb = await sharp(buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();

  await minioClient.putObject(BUCKET, storagePath, buffer, buffer.length, { 'Content-Type': mimeType });
  await minioClient.putObject(BUCKET, thumbnailPath, thumb, thumb.length, { 'Content-Type': 'image/webp' });

  const row = (await db.query(`
    INSERT INTO images (id, filename, original_filename, storage_path, thumbnail_path, mime_type, size_bytes, uploaded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [id, `${id}.${ext}`, req.file.originalname, storagePath, thumbnailPath, mimeType, buffer.length, req.user!.id])).rows[0];

  // Async scan – don't block the response
  scanBuffer(buffer, id).catch(err => logger.error('Scan error', err));

  res.status(201).json(await addUrls(row));
});

// GET /images/:id/file
imagesRouter.get('/:id/file', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `
      SELECT storage_path, mime_type
      FROM images
      WHERE id=$1
      AND is_deleted=FALSE
      `,
      [req.params.id]
    );

    const image = result.rows[0];

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const stream = await minioClient.getObject(
      BUCKET,
      image.storage_path
    );

    res.setHeader(
      'Content-Type',
      image.mime_type
    );

    res.setHeader(
      'Content-Disposition',
      'inline'
    );

    stream.pipe(res);

  } catch (err) {
    logger.error('Image stream error', err);
    res.status(500).json({ error: 'Failed to load image' });
  }
});


// GET /images/:id/thumb
imagesRouter.get('/:id/thumb', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `
      SELECT thumbnail_path
      FROM images
      WHERE id=$1
      AND is_deleted=FALSE
      `,
      [req.params.id]
    );

    const image = result.rows[0];

    if (!image?.thumbnail_path) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    const stream = await minioClient.getObject(
      BUCKET,
      image.thumbnail_path
    );

    res.setHeader(
      'Content-Type',
      'image/webp'
    );

    res.setHeader(
      'Content-Disposition',
      'inline'
    );

    stream.pipe(res);

  } catch (err) {
    logger.error('Thumbnail stream error', err);
    res.status(500).json({ error: 'Failed to load thumbnail' });
  }
});

// GET /images/:id/download
imagesRouter.get('/:id/download', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `
      SELECT storage_path, mime_type, filename
      FROM images
      WHERE id=$1
      AND is_deleted=FALSE
      `,
      [req.params.id]
    );

    const image = result.rows[0];

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const stream = await getObject(image.storage_path);

    res.setHeader(
      'Content-Type',
      image.mime_type
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${image.filename}"`
    );

    stream.pipe(res);

  } catch (err) {
    logger.error('Image download error', err);
    res.status(500).json({ error: 'Failed to download image' });
  }
});

// GET /images/:id
imagesRouter.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.user?.id || null;
  const result = await db.query(`
    SELECT i.*, COUNT(l.id)::int AS like_count,
      ${uid ? 'EXISTS(SELECT 1 FROM likes WHERE image_id=i.id AND user_id=$2)' : 'FALSE'} AS user_liked
    FROM images i LEFT JOIN likes l ON l.image_id=i.id
    WHERE i.id=$1 AND i.is_deleted=FALSE GROUP BY i.id
  `, uid ? [req.params.id, uid] : [req.params.id]);

  if (!result.rows[0]) return res.status(404).json({ error: 'Image not found' });
  res.json(await addUrls(result.rows[0]));
});

// DELETE /images/:id  (admin)
imagesRouter.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const row = (await db.query('SELECT * FROM images WHERE id=$1', [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  await Promise.allSettled([deleteObject(row.storage_path), row.thumbnail_path ? deleteObject(row.thumbnail_path) : Promise.resolve()]);
  await db.query('UPDATE images SET is_deleted=TRUE WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});
