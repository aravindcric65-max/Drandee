require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log("Starting Advanced Profile migration...");
  try {
    // 1. Alter Users Table safely
    console.log("Adding columns to users table...");
    
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_theme VARCHAR(50) DEFAULT 'dark',
      ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS featured_posts JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS custom_badges JSONB DEFAULT '[]';
    `);

    // 2. Create user_links table
    console.log("Creating user_links table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_links (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        url TEXT NOT NULL,
        clicks INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_links_user_id ON user_links(user_id);`);

    console.log("Successfully migrated advanced profile schema.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

migrate();
