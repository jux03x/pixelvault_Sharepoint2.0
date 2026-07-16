import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middlewares/auth';

export const configRouter = Router();

configRouter.get('/', async (_req: Request, res: Response) => {
  const r = await db.query("SELECT value FROM config WHERE key='app'");
  res.json(r.rows[0]?.value || {});
});

configRouter.put('/', requireAdmin, async (req: Request, res: Response) => {
  const cur = (await db.query("SELECT value FROM config WHERE key='app'")).rows[0]?.value || {};
  const updated = {
    ...cur,
    ...(req.body.theme     && { theme:    { ...cur.theme,    ...req.body.theme    } }),
    ...(req.body.branding  && { branding: { ...cur.branding, ...req.body.branding } }),
    ...(req.body.features  && { features: { ...cur.features, ...req.body.features } }),
  };
  await db.query(
    "INSERT INTO config(key,value) VALUES('app',$1) ON CONFLICT(key) DO UPDATE SET value=$1, updated_at=NOW()",
    [JSON.stringify(updated)]
  );
  res.json(updated);
});
