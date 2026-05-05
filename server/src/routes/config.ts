import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middlewares/auth';

export const configRouter = Router();

// GET /config - public
configRouter.get('/', async (_req: Request, res: Response) => {
  const result = await db.query("SELECT value FROM config WHERE key = 'app'");
  if (result.rows.length === 0) return res.json({});
  res.json(result.rows[0].value);
});

// PUT /config - admin only
configRouter.put('/', requireAdmin, async (req: Request, res: Response) => {
  const { theme, branding, features } = req.body;

  const currentResult = await db.query("SELECT value FROM config WHERE key = 'app'");
  const current = currentResult.rows[0]?.value || {};

  const updated = {
    ...current,
    ...(theme && { theme: { ...current.theme, ...theme } }),
    ...(branding && { branding: { ...current.branding, ...branding } }),
    ...(features && { features: { ...current.features, ...features } }),
  };

  await db.query(
    "INSERT INTO config (key, value) VALUES ('app', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
    [JSON.stringify(updated)]
  );

  res.json(updated);
});
