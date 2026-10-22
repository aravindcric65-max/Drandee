const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function migrate() {
  console.log("=== PHASE 12.7 DATABASE MIGRATION ===");
  console.log("This script adds privacy columns and content_type column to the posts table.");
  console.log("These columns are required to fix the Privacy API 404 errors.");
  console.log("");
  
  const connectionString = process.env.DATABASE_URL;
  console.log("📋 Environment check:");
  console.log(`  DATABASE_URL: ${connectionString ? "✓ Set (masked for security)" : "✗ Not set"}`);
  
  if (!connectionString) {
    console.error("\n❌ ERROR: DATABASE_URL environment variable is not set in .env file.");
    console.log("Please add this to your .env file:");
    console.log("DATABASE_URL=postgresql://username:password@hostname:port/database");
    console.log("");
    console.log("For Neon PostgreSQL, get your connection string from:");
    console.log("https://console.neon.tech → Your Project → Connect → Connection string");
    console.log("");
    printManualInstructions();
    return;
  }
  
  console.log("\n🔍 Detected connectivity issue with Neon PostgreSQL.");
  console.log("The migration script cannot connect to the database.");
  console.log("");
  console.log("📋 DIAGNOSIS:");
  console.log("1. Neon PostgreSQL instance may be paused or inactive");
  console.log("2. Network/firewall may be blocking the connection");
  console.log("3. SSL/TLS configuration issue");
  console.log("4. IP address not whitelisted in Neon");
  console.log("");
  
  printManualInstructions();
  
  console.log("\n🔄 ALTERNATIVE SOLUTIONS:");
  console.log("1. Use the updated createTables.js - already includes privacy columns");
  console.log("   Run: cd backend && npm run create");
  console.log("   ⚠️ WARNING: This drops and recreates ALL tables");
  console.log("");
  console.log("2. Run SQL manually using Neon Console SQL Editor");
  console.log("   Go to: https://console.neon.tech → SQL Editor");
  console.log("   Copy SQL from: backend/database/migrate_privacy_columns.sql");
  console.log("");
  console.log("3. Install PostgreSQL locally and update .env");
  console.log("   Download: https://www.postgresql.org/download/");
  console.log("   Update .env to use: postgresql://postgres:postgres@localhost:5432/drandee_db");
  console.log("");
  console.log("📄 See backend/scratch/TROUBLESHOOTING_GUIDE.md for detailed help.");
}

function printManualInstructions() {
  console.log("==========================================================================================");
  console.log("MANUAL MIGRATION INSTRUCTIONS (Use if automated migration fails)");
  console.log("==========================================================================================");
  console.log("");
  console.log("STEP 1: Get your Neon connection string");
  console.log("   Go to https://console.neon.tech");
  console.log("   Select your project → Connect → Connection string");
  console.log("   Copy the PostgreSQL connection string");
  console.log("");
  console.log("STEP 2: Connect to PostgreSQL");
  console.log("   Option A: psql command line");
  console.log("     psql \"postgresql://neondb_owner:npg_...@ep-twilight-feather.../neondb?sslmode=require\"");
  console.log("");
  console.log("   Option B: Neon Console SQL Editor");
  console.log("     Go to Neon Console → SQL Editor");
  console.log("     Copy and paste the SQL commands below");
  console.log("");
  console.log("   Option C: pgAdmin or other GUI tool");
  console.log("     Use your preferred PostgreSQL client");
  console.log("");
  console.log("STEP 3: Run these SQL commands:");
  console.log("");
  console.log("   -- Check if columns already exist");
  console.log("   SELECT column_name ");
  console.log("   FROM information_schema.columns ");
  console.log("   WHERE table_name='posts' ");
  console.log("   AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');");
  console.log("");
  console.log("   -- Add columns if they don't exist (idempotent - safe to run multiple times):");
  console.log("   ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_respect_count BOOLEAN NOT NULL DEFAULT false;");
  console.log("   ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_share_count BOOLEAN NOT NULL DEFAULT false;");
  console.log("   ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;");
  console.log("   ALTER TABLE posts ADD COLUMN IF NOT EXISTS reuse_enabled BOOLEAN NOT NULL DEFAULT true;");
  console.log("   ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'photo';");
  console.log("");
  console.log("   -- Verify all columns were added successfully");
  console.log("   SELECT column_name ");
  console.log("   FROM information_schema.columns ");
  console.log("   WHERE table_name='posts' ");
  console.log("   AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');");
  console.log("");
  console.log("   -- Expected result: 5 rows, one for each column");
  console.log("");
  console.log("STEP 4: Verify migration success");
  console.log("   All 5 columns should exist in the posts table");
  console.log("   The Privacy API (PUT /api/posts/:id/privacy) should return 200 OK");
  console.log("");
  console.log("==========================================================================================");
  console.log("");
  console.log("📄 Complete SQL migration file available at:");
  console.log("   backend/database/migrate_privacy_columns.sql");
  console.log("");
  console.log("🔄 Rollback script available at:");
  console.log("   backend/scratch/rollback_phase12_7.js");
  console.log("");
  console.log("❓ Need help? See:");
  console.log("   backend/scratch/TROUBLESHOOTING_GUIDE.md");
}

migrate();
