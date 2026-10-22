require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    console.log('Running preference columns migration...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS autoplay_videos BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS data_saver_mode BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added autoplay_videos and data_saver_mode to users table.');
  } catch(e) {
    console.error('❌ Migration failed:', e.message);
  } finally {
    await pool.end();
  }
}

run();
