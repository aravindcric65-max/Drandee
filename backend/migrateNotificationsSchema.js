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
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      },
});

async function migrate() {
  try {
    console.log("Migrating notifications table...");
    
    // Add new columns
    await pool.query(`
      ALTER TABLE notifications 
      ADD COLUMN IF NOT EXISTS type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS actor_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS actor_avatar TEXT
    `);
    
    // Check if is_read exists, if so rename it to read
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='notifications' AND column_name='is_read'
    `);
    
    if (res.rows.length > 0) {
      await pool.query(`ALTER TABLE notifications RENAME COLUMN is_read TO read`);
    }

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
