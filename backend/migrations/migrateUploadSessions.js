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
    console.log("🔧 Starting Upload Sessions schema migration...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_sessions (
        id UUID PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'created',
        media_type VARCHAR(100),
        file_name TEXT,
        file_size BIGINT,
        storage_key TEXT,
        storage_url TEXT,
        processing_metadata JSONB,
        error_message TEXT,
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 hour'),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Created upload_sessions table.");

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);`);
    console.log("✅ Created indexes.");

    // Update posts table if it lacks visibility and location_context
    try {
      await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'public';`);
      await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS location_context JSONB;`);
      console.log("✅ Updated posts table schema.");
    } catch (e) {
      console.log("⚠️ Could not update posts table (might not exist yet or already updated).");
    }

    console.log("🎉 Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

migrate();
