-- Migration: add_onboarding_completed
-- Adds the onboarding_completed column to the users table.
-- Referenced by POST /api/user/onboarding in routes/user.js.
-- Idempotent: safe to run multiple times. No destructive operations.

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
