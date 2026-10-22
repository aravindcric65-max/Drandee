# Database Migration Instructions for Phase 12.7

## Overview
This migration adds privacy columns and content_type column to the `posts` table as required by the Instagram-level Profile System spec.

## Required Columns to Add

1. **hide_respect_count** (BOOLEAN, default false)
   - Controls whether respect counts are visible on posts
   
2. **hide_share_count** (BOOLEAN, default false)
   - Controls whether share counts are visible on posts
   
3. **comments_enabled** (BOOLEAN, default true)
   - Controls whether comments are allowed on posts
   
4. **reuse_enabled** (BOOLEAN, default true)
   - Controls whether the post can be reused/remixed
   
5. **content_type** (VARCHAR(20), default 'photo')
   - Defines the type of content: 'photo', 'video', 'reel', 'text', etc.

## Migration Methods

### Method 1: Automated Script (Preferred)
Run the migration script:
```bash
cd backend
node scratch/migrate_phase12_7.js
```

### Method 2: Manual SQL Commands
If the automated script fails due to connectivity issues, run these SQL commands manually:

#### Using psql command line:
```bash
# Connect to your database
psql "postgresql://neondb_owner:npg_MhIiCaHs3L9g@ep-twilight-feather-ahenzckl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Or if using local PostgreSQL
psql -U postgres -d drandee_db
```

#### SQL Commands to Execute:
```sql
-- Check current posts table structure
\d posts

-- Check if columns already exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='posts' 
AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');

-- Add columns if they don't exist
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_respect_count BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_share_count BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reuse_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'photo';

-- Verify all columns were added successfully
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='posts' 
AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');

-- Expected result: 5 rows with the column names listed above
```

### Method 3: Using Database GUI Tool
1. Open your PostgreSQL database tool (pgAdmin, DBeaver, TablePlus, etc.)
2. Connect to your database using the connection details from `.env` file
3. Run the SQL commands from Method 2 above

## Verification

After migration, verify that:
1. All 5 columns exist in the posts table
2. Default values are set correctly
3. Existing posts have the default values applied

## Troubleshooting

### Connection Issues
If you can't connect to the database:
1. Check that your `.env` file has the correct DATABASE_URL
2. Verify network connectivity to the database host
3. Check if the database service is running
4. Ensure firewall allows connections to the database port (usually 5432)

### Permission Issues
If you get permission errors:
1. Verify your database user has ALTER TABLE permissions
2. Check if you're connecting with the correct credentials

### Column Already Exists
If a column already exists, the `IF NOT EXISTS` clause will prevent errors. The migration is idempotent and safe to run multiple times.

## Current Posts Table Schema (Before Migration)
Based on `createTables.js`, the posts table currently has:
- id, user_id, creator_id, creator_name
- video_url, image_url, caption, tags
- overlay_text, text_position, start_time, end_time
- type, total_respects, comment_count, share_count, save_count
- total_watch_time, watch_count, avg_completion_rate
- region, is_deleted, is_private, moderation_status
- rights_expires_at, rights_status, created_at

## Post-Migration Schema
After successful migration, the posts table will have the additional 5 columns listed above.

## Impact
This migration fixes the "Privacy API 404 Not Found" bug by ensuring the required columns exist for privacy controls to work properly.