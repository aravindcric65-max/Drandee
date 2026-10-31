-- Migration: Add firebase_uid and account_status to users table
-- Target: Neon PostgreSQL
-- Idempotent: Safe to execute multiple times

-- UP:
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- DOWN:
-- DROP INDEX IF EXISTS idx_users_firebase_uid;
-- ALTER TABLE users DROP COLUMN IF EXISTS account_status;
-- ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid;
