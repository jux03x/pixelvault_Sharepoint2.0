import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error', { message: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
}
