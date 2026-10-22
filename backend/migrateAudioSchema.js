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
    console.log("🔧 Starting Audio schema migration...");

    // Create audios table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audios (
        id SERIAL PRIMARY KEY
      );
    `);
    
    // Add columns just in case table existed without them
    await pool.query(`
      ALTER TABLE audios
        ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Unknown',
        ADD COLUMN IF NOT EXISTS artist VARCHAR(255),
        ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS duration INTEGER,
        ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
        ADD COLUMN IF NOT EXISTS is_original BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);
    console.log("✅ Created/Altered audios table.");

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audios_name ON audios(name);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audios_usage_count ON audios(usage_count DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audios_is_trending ON audios(is_trending);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audios_created_at ON audios(created_at DESC);`);
    console.log("✅ Created audio indexes.");

    // Add audio_id to posts
    await pool.query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS audio_id INTEGER REFERENCES audios(id);
    `);
    console.log("✅ Added audio_id to posts table.");

    console.log("🎉 Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

migrate();
