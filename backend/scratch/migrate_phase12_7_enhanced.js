const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function migrate() {
  console.log("=== PHASE 12.7 DATABASE MIGRATION (ENHANCED) ===");
  console.log("This script adds privacy columns and content_type column to the posts table.");
  console.log("");
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set.");
    console.log("Please set DATABASE_URL in your .env file or provide it as an environment variable.");
    console.log("Example: postgresql://username:password@hostname:port/database");
    console.log("");
    console.log("📋 Manual SQL commands:");
    printManualSQL();
    return;
  }
  
  console.log("🔗 Using database URL:", connectionString ? "Set (masked for security)" : "Not set");
  console.log("");
  
  console.log("Attempting automated migration...");
  
  try {
    // Test connection with timeout
    const pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000, // 15 seconds timeout
      statement_timeout: 30000, // 30 seconds statement timeout
    });
    
    console.log("Testing database connection...");
    
    // Add a timeout promise to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000);
    });
    
    const connectPromise = pool.connect();
    const client = await Promise.race([connectPromise, timeoutPromise]);
    
    console.log("✅ Database connection successful");
    
    // Check current time
    const testResult = await client.query('SELECT NOW()');
    console.log("Current database time:", testResult.rows[0].now);
    
    console.log("");
    console.log("🔍 Checking posts table structure...");
    
    // Check if columns already exist
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='posts' 
      AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');
    `);
    
    const existingCols = res.rows.map(r => r.column_name);
    console.log("Existing columns:", existingCols.length > 0 ? existingCols.join(", ") : "None found");
    
    // Start transaction
    await client.query('BEGIN');
    
    const addedColumns = [];
    
    // Add missing columns
    if (!existingCols.includes('hide_respect_count')) {
      await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_respect_count BOOLEAN NOT NULL DEFAULT false;`);
      addedColumns.push('hide_respect_count');
      console.log("✅ Added hide_respect_count column");
    } else {
      console.log("✓ hide_respect_count column already exists");
    }
    
    if (!existingCols.includes('hide_share_count')) {
      await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_share_count BOOLEAN NOT NULL DEFAULT false;`);
      addedColumns.push('hide_share_count');
      console.log("✅ Added hide_share_count column");
    } else {
      console.log("✓ hide_share_count column already exists");
    }
    
    if (!existingCols.includes('comments_enabled')) {
      await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;`);
      addedColumns.push('comments_enabled');
      console.log("✅ Added comments_enabled column");
    } else {
      console.log("✓ comments_enabled column already exists");
    }
    
    if (!existingCols.includes('reuse_enabled')) {
      await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS reuse_enabled BOOLEAN NOT NULL DEFAULT true;`);
      addedColumns.push('reuse_enabled');
      console.log("✅ Added reuse_enabled column");
    } else {
      console.log("✓ reuse_enabled column already exists");
    }

    if (!existingCols.includes('content_type')) {
      await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) NOT NULL DEFAULT 'photo';`);
      addedColumns.push('content_type');
      console.log("✅ Added content_type column");
    } else {
      console.log("✓ content_type column already exists");
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log("");
    
    // Verify columns exist
    const verifyRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='posts' 
      AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');
    `);
    
    const verifiedCols = verifyRes.rows.map(r => r.column_name);
    console.log("🔍 Verification:");
    console.log("   Verified columns present:", verifiedCols.join(", "));
    
    if (verifiedCols.length === 5) {
      console.log("🎉 Migration completed successfully. All 5 columns verified.");
    } else {
      console.log(`⚠️  Migration completed, but some columns may be missing. Expected 5, found: ${verifiedCols.length}`);
    }
    
    client.release();
    await pool.end();
    
    console.log("");
    console.log("📊 Migration Summary:");
    console.log(`   Total columns checked: 5`);
    console.log(`   Columns already existed: ${existingCols.length}`);
    console.log(`   Columns added: ${addedColumns.length}`);
    console.log(`   ${addedColumns.length > 0 ? 'Added: ' + addedColumns.join(', ') : 'No columns added (all already exist)'}`);
    
  } catch (e) {
    console.error("\n❌ Migration failed:", e.message);
    console.log("\n📋 Troubleshooting:");
    
    if (e.message.includes('timeout')) {
      console.log("   The connection timed out. This could be due to:");
      console.log("   1. Database server is not responding");
      console.log("   2. Network firewall blocking the connection");
      console.log("   3. Incorrect host/port in DATABASE_URL");
      console.log("   4. Neon PostgreSQL instance may be paused or inaccessible");
    } else if (e.message.includes('ECONNREFUSED')) {
      console.log("   Connection refused. Check if:");
      console.log("   1. Database server is running");
      console.log("   2. Port is correct");
      console.log("   3. Hostname is correct");
    } else if (e.message.includes('password authentication')) {
      console.log("   Authentication failed. Check username/password");
    } else if (e.message.includes('does not exist')) {
      console.log("   Database or table does not exist");
    }
    
    console.log("");
    console.log("🔄 Please run the SQL commands manually:");
    printManualSQL();
  }
}

function printManualSQL() {
  console.log("==========================================================================================");
  console.log("MANUAL MIGRATION INSTRUCTIONS");
  console.log("==========================================================================================");
  console.log("");
  console.log("1. Connect to your PostgreSQL database using one of these methods:");
  console.log("");
  console.log("   Option A: psql command line");
  console.log("     psql 'postgresql://username:password@hostname:port/database'");
  console.log("");
  console.log("   Option B: Neon Console (for Neon PostgreSQL)");
  console.log("     1. Go to https://console.neon.tech");
  console.log("     2. Select your project");
  console.log("     3. Click 'Connect' and choose 'Connection string'");
  console.log("     4. Copy the connection string");
  console.log("     5. Use psql or any PostgreSQL client to connect");
  console.log("");
  console.log("   Option C: pgAdmin or other GUI tool");
  console.log("     Use your preferred PostgreSQL client");
  console.log("");
  console.log("2. Run these SQL commands:");
  console.log("");
  console.log("   -- Check if columns already exist");
  console.log("   SELECT column_name ");
  console.log("   FROM information_schema.columns ");
  console.log("   WHERE table_name='posts' ");
  console.log("   AND column_name IN ('hide_respect_count', 'hide_share_count', 'comments_enabled', 'reuse_enabled', 'content_type');");
  console.log("");
  console.log("   -- Add columns if they don't exist:");
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
  console.log("3. If you get an error that the posts table doesn't exist:");
  console.log("   You need to run the database initialization script first:");
  console.log("   cd backend && npm run create");
  console.log("");
  console.log("==========================================================================================");
}

migrate();