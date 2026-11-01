require("dotenv").config();
const { Pool } = require("pg");

const isLocalDatabase =
  process.env.DATABASE_URL?.includes("localhost") ||
  process.env.DATABASE_URL?.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabase
    ? false
    : {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      },
});

const migrate = async () => {
  try {
    console.log("🔧 Starting feed schema migration...");

    // 1. Alter Posts Table
    await pool.query(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tags TEXT[],
      ADD COLUMN IF NOT EXISTS language VARCHAR(50),
      ADD COLUMN IF NOT EXISTS duration INTEGER,
      ADD COLUMN IF NOT EXISTS sensitivity_level VARCHAR(20) DEFAULT 'low',
      ADD COLUMN IF NOT EXISTS age_restriction INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS rights_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS rights_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
    `);
    console.log("✅ Added new columns to posts table.");

    // 2. Alter Users Table
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS blocked_keywords TEXT[],
      ADD COLUMN IF NOT EXISTS sensitivity_preference VARCHAR(20) DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS age INTEGER,
      ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE;
    `);
    console.log("✅ Added new columns to users table.");

    // 3. Create Indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_language ON posts(language);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_duration ON posts(duration);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_sensitivity_level ON posts(sensitivity_level);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_age_restriction ON posts(age_restriction);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON posts(moderation_status);`);
    console.log("✅ Created necessary indexes for fast ranking.");

    console.log("🎉 Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

migrate();
