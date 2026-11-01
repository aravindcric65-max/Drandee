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
    console.log("🔧 Starting Create & Upload schema migration...");

    // 1. Create drafts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drafts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        media_urls TEXT[],
        edits JSONB,
        caption TEXT,
        hashtags TEXT[],
        audio_id INTEGER REFERENCES audios(id),
        cover_url TEXT,
        privacy VARCHAR(50) DEFAULT 'public',
        settings JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Created drafts table.");

    // 2. Create upload_jobs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        video_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        stage VARCHAR(50) DEFAULT 'preparing',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);
    console.log("✅ Created upload_jobs table.");

    // 3. Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_upload_jobs_user_id ON upload_jobs(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_at ON upload_jobs(created_at DESC);`);
    console.log("✅ Created indexes.");

    // 4. Note: audio_id on posts was already handled in migrateAudioSchema.js
    
    console.log("🎉 Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

migrate();
