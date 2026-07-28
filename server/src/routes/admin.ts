import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '../config/database';
import { minioClient, BUCKET, getSignedUrl } from '../config/storage';
import { requireAdmin, AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const cssUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024*1024 } });

// GET /admin/stats
adminRouter.get('/stats', async (_req, res: Response) => {
  const [imgs, users, lks] = await Promise.all([
    db.query('SELECT COUNT(*)::int FROM images WHERE is_deleted=FALSE'),
    db.query('SELECT COUNT(*)::int FROM users'),
    db.query('SELECT COUNT(*)::int FROM likes'),
  ]);
  res.json({ total_images: imgs.rows[0].count, total_users: users.rows[0].count, total_likes: lks.rows[0].count });
});

// GET /admin/images
adminRouter.get('/images', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
  const offset = (page-1)*limit;

  const rows = await db.query(`
    SELECT i.*, u.email AS uploader_email, COUNT(l.id)::int AS like_count
    FROM images i
    LEFT JOIN users u ON u.id=i.uploaded_by
    LEFT JOIN likes l ON l.image_id=i.id
    WHERE i.is_deleted=FALSE GROUP BY i.id, u.email
    ORDER BY i.created_at DESC LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const total = (await db.query('SELECT COUNT(*)::int FROM images WHERE is_deleted=FALSE')).rows[0].count;

  const images = await Promise.all(rows.rows.map(async img => ({
    ...img,
    url: await getSignedUrl(img.storage_path).catch(() => ''),
    thumbnail_url: img.thumbnail_path ? await getSignedUrl(img.thumbnail_path).catch(() => '') : null,
  })));

  res.json({ images, pagination: { page, limit, total, pages: Math.ceil(total/limit) } });
});

// PUT /admin/images/:id/flag
adminRouter.put('/images/:id/flag', async (req: AuthRequest, res: Response) => {
  await db.query('UPDATE images SET is_flagged=$1 WHERE id=$2', [req.body.flagged !== false, req.params.id]);
  res.json({ message: 'Updated' });
});

// DELETE /admin/images/:id
adminRouter.delete('/images/:id', async (req: AuthRequest, res: Response) => {
  const row = (await db.query('SELECT * FROM images WHERE id=$1', [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  await Promise.allSettled([deleteObject(row.storage_path), row.thumbnail_path ? deleteObject(row.thumbnail_path) : Promise.resolve()]);
  await db.query('UPDATE images SET is_deleted=TRUE WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// GET /admin/users
adminRouter.get('/users', async (_req, res: Response) => {
  const r = await db.query(`
    SELECT u.id, u.email, u.role, u.created_at, COUNT(i.id)::int AS image_count
    FROM users u LEFT JOIN images i ON i.uploaded_by=u.id AND i.is_deleted=FALSE
    GROUP BY u.id ORDER BY u.created_at DESC
  `);
  res.json({ users: r.rows });
});

// POST /admin/users  – create user
adminRouter.post('/users', async (req: AuthRequest, res: Response) => {
  const { email, password, role = 'user' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const r = await db.query(
      'INSERT INTO users (email, password, role) VALUES ($1,$2,$3) RETURNING id,email,role',
      [email.toLowerCase(), hash, role]
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    throw e;
  }
});

// DELETE /admin/users/:id
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  if (req.user!.id === req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// POST /admin/css
adminRouter.post('/css', cssUpload.single('css'), async (_req, res: Response) => {
  const req = _req as AuthRequest;
  if (!req.file) return res.status(400).json({ error: 'No CSS file' });
  await minioClient.putObject(BUCKET, 'custom/custom.css', req.file.buffer, req.file.buffer.length, { 'Content-Type': 'text/css' });
  await db.query(
    "INSERT INTO config(key,value) VALUES('custom_css_path','\"custom/custom.css\"') ON CONFLICT(key) DO UPDATE SET value='\"custom/custom.css\"', updated_at=NOW()"
  );
  logger.info('Custom CSS uploaded');
  res.json({ message: 'CSS uploaded' });
});
