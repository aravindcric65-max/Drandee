require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add unique constraint on post_reports
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_active_post_report_idx 
      ON post_reports (reporter_id, post_id);
    `);

    // Add unique constraint on user_reports (using 'post_id' since the schema named it incorrectly)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_active_user_report_idx 
      ON user_reports (reporter_id, post_id);
    `);

    // Add unique constraint on reports (reels) where status = pending
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_active_reel_report_idx 
      ON reports (reporter_id, reel_id)
      WHERE status = 'pending';
    `);

    await client.query('COMMIT');
    console.log("Migration successful: Added duplicate report constraints.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
