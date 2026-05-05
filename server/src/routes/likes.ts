import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../config/database';
import { requireAuth, AuthRequest } from '../middlewares/auth';

export const likesRouter = Router();

const likeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

// POST /images/:id/like
likesRouter.post('/:id/like', requireAuth, likeLimiter, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const imageResult = await db.query('SELECT id FROM images WHERE id = $1 AND is_deleted = FALSE', [id]);
  if (imageResult.rows.length === 0) return res.status(404).json({ error: 'Image not found' });

  try {
    await db.query(
      'INSERT INTO likes (image_id, user_id, ip_address) VALUES ($1, $2, $3)',
      [id, userId, req.ip]
    );
  } catch (err: any) {
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Already liked' });
    }
    throw err;
  }

  const countResult = await db.query('SELECT COUNT(*) FROM likes WHERE image_id = $1', [id]);
  res.json({ liked: true, like_count: parseInt(countResult.rows[0].count) });
});

// DELETE /images/:id/like
likesRouter.delete('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  await db.query('DELETE FROM likes WHERE image_id = $1 AND user_id = $2', [id, userId]);

  const countResult = await db.query('SELECT COUNT(*) FROM likes WHERE image_id = $1', [id]);
  res.json({ liked: false, like_count: parseInt(countResult.rows[0].count) });
});
