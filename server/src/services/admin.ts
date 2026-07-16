import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';

// Creates the admin user on first start if ADMIN_EMAIL + ADMIN_PASSWORD are set
export async function ensureAdminUser(db: Pool): Promise<void> {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set – skipping admin creation');
    return;
  }

  const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows.length > 0) {
    // Make sure existing user is admin
    await db.query("UPDATE users SET role='admin' WHERE email=$1", [email]);
    logger.info(`✅ Admin user confirmed: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await db.query(
    'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
    [email.toLowerCase(), hash, 'admin']
  );
  logger.info(`✅ Admin user created: ${email}`);
}
