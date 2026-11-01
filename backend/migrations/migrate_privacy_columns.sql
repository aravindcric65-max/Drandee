-- ============================================
-- Instagram-level Profile System Migration
-- Phase 12.7: Add Privacy Columns to Posts Table
-- ============================================

-- This SQL file adds the required privacy columns to the posts table
-- These columns are needed to fix the privacy API 404 errors

-- ============================================
-- STEP 1: Check current table structure
-- ============================================

-- First, check if the posts table exists
SELECT 
    table_name,
    EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'posts'
    ) as table_exists
FROM information_schema.tables 
WHERE table_name = 'posts';

-- Check current columns in posts table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'posts'
ORDER BY ordinal_position;

-- ============================================
-- STEP 2: Check if privacy columns already exist
-- ============================================

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'posts' 
AND column_name IN (
    'hide_respect_count', 
    'hide_share_count', 
    'comments_enabled', 
    'reuse_enabled', 
    'content_type'
);

-- ============================================
-- STEP 3: Add missing privacy columns
-- ============================================

-- Note: Using ADD COLUMN IF NOT EXISTS to make migration idempotent
-- This means you can run this migration multiple times safely

-- 1. hide_respect_count - Controls visibility of respect counts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_respect_count BOOLEAN NOT NULL DEFAULT false;

-- 2. hide_share_count - Controls visibility of share counts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_share_count BOOLEAN NOT NULL DEFAULT false;

-- 3. comments_enabled - Controls whether comments are allowed
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;

-- 4. reuse_enabled - Controls whether content can be reused/remixed
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reuse_enabled BOOLEAN NOT NULL DEFAULT true;

-- 5. content_type - For reliable classification (photo, video, text)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'photo';

-- ============================================
-- STEP 4: Verify the migration
-- ============================================

-- Verify all columns were added successfully
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'posts' 
AND column_name IN (
    'hide_respect_count', 
    'hide_share_count', 
    'comments_enabled', 
    'reuse_enabled', 
    'content_type'
)
ORDER BY column_name;

-- ============================================
-- STEP 5: Optional - Update existing posts
-- ============================================

-- If you want to initialize content_type for existing posts based on their data:
-- (This is optional but recommended for consistency)

-- Update content_type for video posts
UPDATE posts 
SET content_type = 'video'
WHERE (video_url IS NOT NULL AND video_url != '') 
   OR type = 'video' 
   OR type = 'reel'
   AND content_type = 'photo'; -- Only update if still default

-- Update content_type for text/discussion posts
UPDATE posts 
SET content_type = 'text'
WHERE (type = 'text' OR type = 'discussion')
   AND content_type = 'photo'; -- Only update if still default

-- ============================================
-- STEP 6: Create index for performance (optional)
-- ============================================

-- Create an index on content_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts(content_type);

-- Create an index on privacy columns for faster queries
CREATE INDEX IF NOT EXISTS idx_posts_privacy_settings ON posts(
    hide_respect_count, 
    hide_share_count, 
    comments_enabled, 
    reuse_enabled
);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Summary report
SELECT 
    'Migration Complete' as status,
    COUNT(*) as total_columns_added,
    (SELECT COUNT(*) FROM posts WHERE content_type != 'photo') as posts_updated,
    CURRENT_TIMESTAMP as completed_at
FROM information_schema.columns 
WHERE table_name = 'posts' 
AND column_name IN (
    'hide_respect_count', 
    'hide_share_count', 
    'comments_enabled', 
    'reuse_enabled', 
    'content_type'
);