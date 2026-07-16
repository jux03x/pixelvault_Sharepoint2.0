import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../config/database';
import { requireAuth, AuthRequest } from '../middlewares/auth';

export const likesRouter = Router();
const limiter = rateLimit({ windowMs: 60*1000, max: 60 });

likesRouter.post('/:id/like', requireAuth, limiter, async (req: AuthRequest, res: Response) => {
  const img = (await db.query('SELECT id FROM images WHERE id=$1 AND is_deleted=FALSE', [req.params.id])).rows[0];
  if (!img) return res.status(404).json({ error: 'Image not found' });
  try {
    await db.query('INSERT INTO likes (image_id, user_id) VALUES ($1,$2)', [req.params.id, req.user!.id]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Already liked' });
    throw e;
  }
  const count = (await db.query('SELECT COUNT(*)::int FROM likes WHERE image_id=$1', [req.params.id])).rows[0].count;
  res.json({ liked: true, like_count: count });
});

likesRouter.delete('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  await db.query('DELETE FROM likes WHERE image_id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
  const count = (await db.query('SELECT COUNT(*)::int FROM likes WHERE image_id=$1', [req.params.id])).rows[0].count;
  res.json({ liked: false, like_count: count });
});
