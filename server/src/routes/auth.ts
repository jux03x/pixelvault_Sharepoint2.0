import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { db } from '../config/database';
import { signToken, requireAuth, AuthRequest } from '../middlewares/auth';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts – please wait 15 minutes' },
});

// POST /auth/login
authRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const result = await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
  const user = result.rows[0];

  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user.id, user.email, user.role);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// POST /auth/register  (only if REGISTRATION_OPEN=true)
authRouter.post('/register', loginLimiter, async (req: Request, res: Response) => {
  if (process.env.REGISTRATION_OPEN !== 'true') {
    return res.status(403).json({ error: 'Registration is closed. Contact the admin.' });
  }

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 12);
  const result = await db.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING id, email, role",
    [email.toLowerCase(), hash]
  );

  const user = result.rows[0];
  const token = signToken(user.id, user.email, user.role);
  res.status(201).json({ token, user });
});

// GET /auth/me
authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json(req.user);
});
