import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

export async function ensureAppPassword(db: Pool): Promise<void> {
  const configuredPassword = process.env.APP_PASSWORD;

  if (!configuredPassword) {
    throw new Error(
      'APP_PASSWORD is not configured'
    );
  }

  const result = await db.query(
    `
    SELECT id
    FROM app_password
    WHERE id = 1
    `
  );

  if (result.rows.length > 0) {
    logger.info('App password already configured');
    return;
  }

  const passwordHash = await bcrypt.hash(
    configuredPassword,
    12
  );

  await db.query(
    `
    INSERT INTO app_password (
      id,
      password_hash
    )
    VALUES (1, $1)
    `,
    [passwordHash]
  );

  logger.info('✅ App password initialized');
}