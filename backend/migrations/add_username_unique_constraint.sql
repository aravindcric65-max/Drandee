-- Migration: add_username_unique_constraint
-- Adds a UNIQUE constraint on users.username.
-- Handles existing duplicates first by appending the row id as a suffix.
-- Idempotent — safe to run multiple times.
-- Run this manually against Neon PostgreSQL BEFORE deploying.

-- Step 1: Fix any existing duplicate usernames by appending the row id as a suffix
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT id, username
    FROM (
      SELECT id, username,
             ROW_NUMBER() OVER (PARTITION BY username ORDER BY id) AS rn
      FROM users
      WHERE username IS NOT NULL
    ) t
    WHERE rn > 1
  LOOP
    UPDATE users SET username = username || '_' || dup.id WHERE id = dup.id;
  END LOOP;
END $$;

-- Step 2: Add UNIQUE constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_unique'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END $$;
