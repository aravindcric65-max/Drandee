-- Migration: add_missing_user_columns
-- Adds all columns referenced by routes/user.js GET /:id and formatUser()
-- that may be missing from the users table.
-- Idempotent — safe to run multiple times.
-- Run this manually against Neon PostgreSQL.

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_badge VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS star_friends JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_level VARCHAR(50) DEFAULT 'Emerging';
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_dopamine_score NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_velocity_score NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS peak_velocity_24h NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_velocity_7d NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_watch_time INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_theme VARCHAR(20) DEFAULT 'dark';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_posts JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_badges JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS frame_style VARCHAR(50) DEFAULT 'gradient';
ALTER TABLE users ADD COLUMN IF NOT EXISTS niche JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
