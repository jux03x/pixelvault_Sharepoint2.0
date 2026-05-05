import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { db } from '../config/database';
import { signToken } from '../middlewares/auth';
import { sendMagicLinkEmail } from '../services/email';
import { logger } from '../utils/logger';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later' },
});

// POST /auth/request-link
authRouter.post('/request-link', authLimiter, async (req: Request, res: Response) => {
  const { email, accessCode } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Check access code if configured
  if (process.env.ACCESS_CODE && accessCode !== process.env.ACCESS_CODE) {
    return res.status(403).json({ error: 'Invalid access code' });
  }

  const token = uuidv4() + '-' + uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.query(
    'INSERT INTO magic_links (email, token, expires_at) VALUES ($1, $2, $3)',
    [email.toLowerCase(), token, expiresAt]
  );

  const magicLinkUrl = `${process.env.APP_URL || 'http://localhost:8080'}/auth/verify?token=${token}`;

  try {
    await sendMagicLinkEmail(email, magicLinkUrl);
    logger.info(`Magic link sent to ${email}`);
  } catch (err) {
    // Log the link in development so you can still log in without SMTP
    logger.warn(`📧 Email sending failed. Magic link for ${email}:`);
    logger.warn(`🔗 ${magicLinkUrl}`);
  }

  res.json({ message: 'Magic link sent! Check your email.' });
});

// POST /auth/verify
authRouter.post('/verify', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: 'Token required' });

  const result = await db.query(
    'SELECT * FROM magic_links WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
    [token]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid or expired magic link' });
  }

  const magicLink = result.rows[0];
  const email = magicLink.email;

  // Mark token as used
  await db.query('UPDATE magic_links SET used = TRUE WHERE id = $1', [magicLink.id]);

  // Get or create user
  let userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);

  let user;
  if (userResult.rows.length === 0) {
    // Create new user - check if they should be admin
    const role = email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase() ? 'admin' : 'user';
    const insertResult = await db.query(
      'INSERT INTO users (email, role) VALUES ($1, $2) RETURNING *',
      [email, role]
    );
    user = insertResult.rows[0];
    logger.info(`New user created: ${email} (${role})`);
  } else {
    user = userResult.rows[0];
    // Upgrade to admin if this is the admin email
    if (email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase() && user.role !== 'admin') {
      await db.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', user.id]);
      user.role = 'admin';
    }
  }

  const jwtToken = signToken(user.id, user.email, user.role);

  res.json({
    token: jwtToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

// GET /auth/me
authRouter.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });

  const token = authHeader.slice(7);
  try {
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET || 'fallback') as {
      userId: string; email: string; role: string;
    };
    res.json({ id: payload.userId, email: payload.email, role: payload.role });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
