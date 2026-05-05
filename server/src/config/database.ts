import { Pool } from 'pg';
import { logger } from '../utils/logger';

export const db = new Pool({
  connectionString: process.env.DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err) => {
  logger.error('Unexpected DB error', err);
});

export async function checkDbConnection() {
  try {
    await db.query('SELECT 1');
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Database connection failed', err);
    process.exit(1);
  }
}
