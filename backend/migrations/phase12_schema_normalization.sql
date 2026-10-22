-- Phase 12: Database Schema Normalization Migration
-- Purpose: Add missing columns, indexes, and constraints for production bug fixes
-- Date: Generated during Phase 2-14 execution
-- SAFE TO RUN MULTIPLE TIMES (uses IF NOT EXISTS)

-- ═══════════════════════════════════════════════════════
-- 1. ADD MISSING COLUMNS
-- ═══════════════════════════════════════════════════════

-- Posts table: thumbnail_url for video thumbnails (Bug 1-2)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Users table: saved_posts array for bookmarking (Bug 18-19)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS saved_posts INTEGER[] DEFAULT '{}';

-- ═══════════════════════════════════════════════════════
-- 2. ADD PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════

-- Index on posts.creator_id for profile queries
CREATE INDEX IF NOT EXISTS idx_posts_creator_id ON posts(creator_id);

-- Index on posts.content_type for filtering by type
CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts(content_type);

-- Index on posts.created_at DESC for chronological feeds
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts(created_at DESC);

-- GIN index on users.following for follower lookups
CREATE INDEX IF NOT EXISTS idx_users_following_gin ON users USING GIN(following);

-- Full-text search index on posts.caption (Bug 10-11)
CREATE INDEX IF NOT EXISTS idx_posts_caption_fts ON posts 
USING GIN (to_tsvector('english', caption));

-- GIN index on posts.tags for hashtag search (Bug 5, Bug 10-11)
CREATE INDEX IF NOT EXISTS idx_posts_tags_gin ON posts 
USING GIN (tags);

-- ═══════════════════════════════════════════════════════
-- 3. PRIVATE ACCOUNTS SYSTEM (Bug 14-17)
-- ═══════════════════════════════════════════════════════

-- Create follow_requests table if not exists
CREATE TABLE IF NOT EXISTS follow_requests (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, target_id)
);

-- Index on follow_requests for pending requests lookup
CREATE INDEX IF NOT EXISTS idx_follow_requests_target_status 
ON follow_requests(target_id, status);

-- Index on follow_requests for requester lookup
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester 
ON follow_requests(requester_id);

-- ═══════════════════════════════════════════════════════
-- 4. VERIFY CONSTRAINTS
-- ═══════════════════════════════════════════════════════

-- Ensure content_type constraint exists (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'posts_content_type_check'
  ) THEN
    ALTER TABLE posts 
    ADD CONSTRAINT posts_content_type_check 
    CHECK (content_type IN ('image', 'video', 'text', 'carousel'));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- 5. DATA INTEGRITY CHECKS (Optional - Run Separately)
-- ═══════════════════════════════════════════════════════

-- Check for orphaned posts (posts without valid creator)
-- SELECT id, creator_id FROM posts 
-- WHERE creator_id NOT IN (SELECT id FROM users);

-- Check for posts without content_type
-- SELECT id, type, content_type FROM posts 
-- WHERE content_type IS NULL OR content_type = '';

-- ═══════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════

-- Verification queries:
-- SELECT COUNT(*) FROM posts WHERE thumbnail_url IS NOT NULL;
-- SELECT COUNT(*) FROM users WHERE saved_posts IS NOT NULL;
-- SELECT COUNT(*) FROM follow_requests WHERE status = 'pending';

-- Index verification:
-- SELECT tablename, indexname FROM pg_indexes 
-- WHERE tablename IN ('posts', 'users', 'follow_requests')
-- ORDER BY tablename, indexname;
