-- Migration: add_user_prefs_columns
-- Adds autoplay_videos and data_saver_mode columns to the users table.
-- Referenced by GET /api/settings/preferences and PUT /api/settings/preferences in routes/settings.js.
-- Idempotent: safe to run multiple times. No destructive operations.
-- Approved by owner on Phase 1 Task 6.

ALTER TABLE users ADD COLUMN IF NOT EXISTS autoplay_videos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_saver_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- DOWN (rollback — do NOT run unless explicitly approved):
-- ALTER TABLE users DROP COLUMN IF EXISTS autoplay_videos;
-- ALTER TABLE users DROP COLUMN IF EXISTS data_saver_mode;
