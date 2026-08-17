import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { db, waitForDb } from './config/database';
import { runMigrations } from './config/migrations';
import { ensureBucket, waitForMinio } from './config/storage';
import { waitForClamAV } from './services/clamav';
import { ensureAdminUser } from './services/admin';
import { authRouter } from './routes/auth';
import { imagesRouter } from './routes/images';
import { likesRouter } from './routes/likes';
import { configRouter } from './routes/config';
import { adminRouter } from './routes/admin';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';
import { ensureAppPassword } from './services/appPassword';
import cookieParser from 'cookie-parser';
import { appPasswordRouter } from './routes/appPassword';
import { requireAppAccess } from './middlewares/appAccess';

async function start() {
  logger.info('🚀 PixelVault starting up…');

  // ── Wait for all dependencies ────────────────────────────────────────────
  await waitForDb();
  await waitForMinio();
  await waitForClamAV();

  // ── Initialize ───────────────────────────────────────────────────────────
  await runMigrations(db);
  await ensureAppPassword(db);
  await ensureBucket();
  await ensureAdminUser(db);

  // ── Express app ──────────────────────────────────────────────────────────
  const app = express();
  const PORT = 3000;

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: process.env.APP_URL || '*', credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Public
app.get('/health', (_req, res) =>
  res.json({ status: 'ok' })
);

app.use('/app-password', appPasswordRouter);

// App password required
app.use(requireAppAccess);

app.use('/auth', authRouter);
app.use('/images', imagesRouter);
app.use('/images', likesRouter);
app.use('/config', configRouter);
app.use('/admin', adminRouter);

app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Server ready on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
