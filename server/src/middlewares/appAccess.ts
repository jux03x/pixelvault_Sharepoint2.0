import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const APP_SESSION_SECRET =
  process.env.APP_SESSION_SECRET ||
  'fallback-change-me';

const COOKIE_NAME = 'pv_app_session';

export function requireAppAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(403).json({
      error: 'App password required',
    });
  }

  try {
    jwt.verify(
      token,
      APP_SESSION_SECRET
    );

    next();
  } catch {
    return res.status(403).json({
      error: 'App password required',
    });
  }
}