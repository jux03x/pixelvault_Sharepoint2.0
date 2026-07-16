import { Pool } from 'pg';
import { logger } from '../utils/logger';

const MIGRATION = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (password-based auth, no magic links)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename          VARCHAR(512) NOT NULL,
  original_filename VARCHAR(512),
  storage_path      VARCHAR(1024) NOT NULL,
  thumbnail_path    VARCHAR(1024),
  mime_type         VARCHAR(100) NOT NULL,
  size_bytes        BIGINT,
  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_flagged        BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  scan_status       VARCHAR(20) DEFAULT 'pending'
    CHECK (scan_status IN ('pending','clean','infected','error'))
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id    UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(image_id, user_id)
);

-- App config table
CREATE TABLE IF NOT EXISTS config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         VARCHAR(255) UNIQUE NOT NULL,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_images_created_at   ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_not_deleted  ON images(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_likes_image_id      ON likes(image_id);

-- Default app config (only inserted once)
INSERT INTO config (key, value)
VALUES ('app', '{
  "theme": {
    "primaryColor": "#0a0a0a",
    "accentColor": "#007AFF",
    "backgroundColor": "#fafafa",
    "font": "DM Sans, sans-serif"
  },
  "branding": {
    "title": "PixelVault",
    "description": "Share your moments beautifully"
  },
  "features": {
    "likesEnabled": true,
    "uploadEnabled": true
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
`;

export async function runMigrations(db: Pool): Promise<void> {
  logger.info('Running database migrations…');
  try {
    await db.query(MIGRATION);
    logger.info('✅ Database migrations complete');
  } catch (err) {
    logger.error('❌ Migration failed', err);
    throw err;
  }
}
