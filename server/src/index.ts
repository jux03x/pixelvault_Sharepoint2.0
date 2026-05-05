import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { authRouter } from './routes/auth';
import { imagesRouter } from './routes/images';
import { likesRouter } from './routes/likes';
import { configRouter } from './routes/config';
import { adminRouter } from './routes/admin';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.APP_URL || '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/auth', authRouter);
app.use('/images', imagesRouter);
app.use('/images', likesRouter);
app.use('/config', configRouter);
app.use('/admin', adminRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 PixelVault Server running on port ${PORT}`);
});

export default app;
