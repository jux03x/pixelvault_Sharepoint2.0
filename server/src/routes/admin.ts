import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '../config/database';
import { minioClient, BUCKET, deleteObject } from '../config/storage';
import { requireAdmin, AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const cssUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

// GET /admin/images - all images including flagged
adminRouter.get('/images', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
  const offset = (page - 1) * limit;

  const result = await db.query(`
    SELECT i.*, u.email as uploader_email, COUNT(l.id) as like_count
    FROM images i
    LEFT JOIN users u ON u.id = i.uploaded_by
    LEFT JOIN likes l ON l.image_id = i.id
    WHERE i.is_deleted = FALSE
    GROUP BY i.id, u.email
    ORDER BY i.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const countResult = await db.query('SELECT COUNT(*) FROM images WHERE is_deleted = FALSE');

  res.json({
    images: result.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    },
  });
});

// PUT /admin/images/:id/flag
adminRouter.put('/images/:id/flag', async (req: AuthRequest, res: Response) => {
  const { flagged } = req.body;
  await db.query('UPDATE images SET is_flagged = $1 WHERE id = $2', [flagged !== false, req.params.id]);
  res.json({ message: 'Image flag updated' });
});

// DELETE /admin/images/:id
adminRouter.delete('/images/:id', async (req: AuthRequest, res: Response) => {
  const result = await db.query('SELECT * FROM images WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const image = result.rows[0];
  try {
    await deleteObject(image.storage_path);
    if (image.thumbnail_path) await deleteObject(image.thumbnail_path);
  } catch (err) {
    logger.warn('Storage delete failed', err);
  }

  await db.query('UPDATE images SET is_deleted = TRUE WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// GET /admin/users
adminRouter.get('/users', async (_req: AuthRequest, res: Response) => {
  const result = await db.query(`
    SELECT u.*, COUNT(i.id) as image_count
    FROM users u
    LEFT JOIN images i ON i.uploaded_by = u.id AND i.is_deleted = FALSE
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  res.json({ users: result.rows });
});

// POST /admin/css - upload custom CSS
adminRouter.post('/css', cssUpload.single('css'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No CSS file' });

  const cssContent = req.file.buffer.toString('utf-8');
  const objectPath = 'custom/custom.css';

  await minioClient.putObject(BUCKET, objectPath, req.file.buffer, req.file.buffer.length, {
    'Content-Type': 'text/css',
  });

  await db.query(
    "INSERT INTO config (key, value) VALUES ('custom_css_path', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
    [JSON.stringify(objectPath)]
  );

  logger.info('Custom CSS uploaded');
  res.json({ message: 'CSS uploaded', path: objectPath });
});

// GET /admin/stats
adminRouter.get('/stats', async (_req: AuthRequest, res: Response) => {
  const [images, users, likes] = await Promise.all([
    db.query('SELECT COUNT(*) FROM images WHERE is_deleted = FALSE'),
    db.query('SELECT COUNT(*) FROM users'),
    db.query('SELECT COUNT(*) FROM likes'),
  ]);

  res.json({
    total_images: parseInt(images.rows[0].count),
    total_users: parseInt(users.rows[0].count),
    total_likes: parseInt(likes.rows[0].count),
  });
});
