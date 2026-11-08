-- Migration: add username_set column to users table
-- This flag distinguishes user-chosen usernames from auto-generated ones.
-- Auto-generated usernames (set at registration) get username_set = false.
-- When a user explicitly sets their username during onboarding, username_set = true.
-- This prevents the onboarding username step from being skipped for users who
-- only have an auto-generated username.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username_set BOOLEAN DEFAULT false;

-- Existing users who completed onboarding are assumed to have set their username.
UPDATE users SET username_set = true WHERE onboarding_completed = true AND username IS NOT NULL;
