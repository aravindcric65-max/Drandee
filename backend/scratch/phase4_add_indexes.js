require("dotenv").config(); // Load from CWD (.env)
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

const addIndexes = async () => {
  try {
    console.log("🚀 Starting Phase 4 Database Index Optimization...");

    console.log("Indexing follows.following_id...");
    await pool.query(`CREATE INDEX IF NOT EXISTS follows_following_id_idx ON follows (following_id);`);

    console.log("Indexing posts.created_at (DESC)...");
    await pool.query(`CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);`);

    console.log("Indexing watch_sessions.post_id...");
    await pool.query(`CREATE INDEX IF NOT EXISTS watch_sessions_post_id_idx ON watch_sessions (post_id);`);

    console.log("✅ Phase 4 Database Optimization Complete!");
  } catch (err) {
    console.error("❌ SQL Error:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.exit();
  }
};

addIndexes();
