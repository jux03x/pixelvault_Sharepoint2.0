import { Pool } from 'pg';
import { logger } from '../utils/logger';

export const db = new Pool({
  connectionString: process.env.DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

db.on('error', (err) => logger.error('DB pool error', err));

export async function waitForDb(): Promise<void> {
  const MAX = 30;
  for (let i = 1; i <= MAX; i++) {
    try {
      await db.query('SELECT 1');
      logger.info('✅ PostgreSQL connected');
      return;
    } catch (err) {
      logger.info(`PostgreSQL not ready (attempt ${i}/${MAX}) – retrying in 2s…`);
      await sleep(2000);
    }
  }
  throw new Error('PostgreSQL did not become ready in time');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
