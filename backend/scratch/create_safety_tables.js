const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        blocker_id UUID,
        blocked_id UUID
      );
      CREATE TABLE IF NOT EXISTS user_mutes (
        user_id UUID,
        muted_id UUID
      );
      CREATE TABLE IF NOT EXISTS not_interested_posts (
        user_id UUID,
        post_id UUID
      );
      CREATE TABLE IF NOT EXISTS user_reports (
        reporter_id UUID,
        post_id UUID
      );
    `);
    console.log('Tables created');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
