import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

import { db } from '../config/database';

export const appPasswordRouter = Router();

const APP_SESSION_SECRET =
  process.env.APP_SESSION_SECRET ||
  'fallback-change-me';

const COOKIE_NAME = 'pv_app_session';

const appPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many attempts – please wait 15 minutes',
  },
});

appPasswordRouter.post(
  '/unlock',
  appPasswordLimiter,
  async (req: Request, res: Response) => {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password required',
      });
    }

    const result = await db.query(
      `
      SELECT password_hash
      FROM app_password
      WHERE id = 1
      `
    );

    const appPassword = result.rows[0];

    if (!appPassword) {
      return res.status(500).json({
        error: 'App password is not configured',
      });
    }

    const valid = await bcrypt.compare(
      password,
      appPassword.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid app password',
      });
    }

    const sessionToken = jwt.sign(
      {
        type: 'app-access',
      },
      APP_SESSION_SECRET,
      {
        expiresIn: '2h',
      }
    );

    res.cookie(
      COOKIE_NAME,
      sessionToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000,
        path: '/',
      }
    );

    res.json({
      unlocked: true,
    });
  }
);

appPasswordRouter.get(
  '/check',
  (req: Request, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        unlocked: false,
      });
    }

    try {
      jwt.verify(
        token,
        APP_SESSION_SECRET
      );

      return res.json({
        unlocked: true,
      });
    } catch {
      return res.status(401).json({
        unlocked: false,
      });
    }
  }
);

appPasswordRouter.post(
  '/logout',
  (_req: Request, res: Response) => {
    res.clearCookie(
      COOKIE_NAME,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      }
    );

    res.json({
      unlocked: false,
    });
  }
);