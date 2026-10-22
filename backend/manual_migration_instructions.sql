-- MANUAL MIGRATION INSTRUCTIONS FOR PHASE 12.7
-- Run these SQL commands in your PostgreSQL database to add the required columns

-- Check if columns already exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='posts' 
AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');

-- Add columns if they don't exist:
-- 1. hide_respect_count
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_respect_count BOOLEAN NOT NULL DEFAULT false;

-- 2. hide_share_count
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_share_count BOOLEAN NOT NULL DEFAULT false;

-- 3. comments_enabled
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;

-- 4. reuse_enabled
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reuse_enabled BOOLEAN NOT NULL DEFAULT true;

-- 5. content_type
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'photo';

-- Verify all columns were added successfully
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='posts' 
AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');

-- Expected result: 5 rows with the column names listed above