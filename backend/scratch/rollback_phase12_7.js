const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function rollback() {
  console.log("=== PHASE 12.7 DATABASE ROLLBACK ===");
  console.log("This script removes the privacy columns from the posts table if needed.");
  console.log("⚠️  WARNING: This will delete data in the privacy columns!");
  console.log("");
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set.");
    console.log("Cannot proceed with rollback.");
    return;
  }
  
  console.log("Are you sure you want to remove the privacy columns?");
  console.log("This action is IRREVERSIBLE for any data in these columns.");
  console.log("");
  console.log("Type 'YES, REMOVE COLUMNS' to confirm:");
  
  // In a real scenario, you would read user input here
  // For now, we'll just print the manual instructions
  console.log("");
  console.log("🔄 Manual rollback instructions:");
  console.log("==========================================================================================");
  console.log("");
  console.log("1. Connect to your PostgreSQL database:");
  console.log("   psql 'postgresql://username:password@hostname:port/database'");
  console.log("");
  console.log("2. Run these SQL commands to remove the columns:");
  console.log("");
  console.log("   -- First, backup any important data (optional)");
  console.log("   SELECT id, hide_respect_count, hide_share_count, comments_enabled, reuse_enabled, content_type");
  console.log("   FROM posts");
  console.log("   WHERE hide_respect_count = true OR hide_share_count = true");
  console.log("      OR comments_enabled = false OR reuse_enabled = false");
  console.log("      OR content_type != 'photo';");
  console.log("");
  console.log("   -- Remove columns");
  console.log("   ALTER TABLE posts DROP COLUMN IF EXISTS hide_respect_count;");
  console.log("   ALTER TABLE posts DROP COLUMN IF EXISTS hide_share_count;");
  console.log("   ALTER TABLE posts DROP COLUMN IF EXISTS comments_enabled;");
  console.log("   ALTER TABLE posts DROP COLUMN IF EXISTS reuse_enabled;");
  console.log("   ALTER TABLE posts DROP COLUMN IF EXISTS content_type;");
  console.log("");
  console.log("   -- Verify columns were removed");
  console.log("   SELECT column_name ");
  console.log("   FROM information_schema.columns ");
  console.log("   WHERE table_name='posts' ");
  console.log("   AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');");
  console.log("");
  console.log("   -- This query should return 0 rows if successful");
  console.log("");
  console.log("==========================================================================================");
  console.log("");
  console.log("⚠️  IMPORTANT: If you drop these columns, the privacy API will return 404 errors again.");
  console.log("   The Instagram-level Profile System requires these columns to function properly.");
}

rollback();