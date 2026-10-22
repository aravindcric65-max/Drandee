require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function createView() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Ensure creator_earnings table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_earnings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // View for overall creator stats
    await client.query(`
      CREATE OR REPLACE VIEW creator_dashboard_view AS
      SELECT 
        p.user_id,
        COUNT(p.id) as post_count,
        COALESCE(SUM(p.total_respects), 0) as total_respects,
        COALESCE(SUM(p.comment_count), 0) as total_comments,
        COALESCE(SUM(p.share_count), 0) as total_shares,
        COALESCE(SUM(p.watch_count), 0) as total_views
      FROM posts p
      WHERE p.is_deleted = false
      GROUP BY p.user_id
    `);

    // View for daily analytics
    await client.query(`
      CREATE OR REPLACE VIEW creator_daily_analytics_view AS
      SELECT 
        p.user_id,
        DATE(p.created_at) as date,
        COUNT(p.id) as post_count,
        COALESCE(SUM(p.total_respects), 0) as total_respects,
        COALESCE(SUM(p.comment_count), 0) as total_comments,
        COALESCE(SUM(p.share_count), 0) as total_shares,
        COALESCE(SUM(p.watch_count), 0) as total_views,
        COALESCE(SUM(e.earnings), 0) as total_earnings
      FROM posts p
      LEFT JOIN (
        SELECT post_id, SUM(amount) as earnings 
        FROM creator_earnings 
        GROUP BY post_id
      ) e ON e.post_id = p.id
      WHERE p.is_deleted = false
      GROUP BY p.user_id, DATE(p.created_at)
    `);

    await client.query('COMMIT');
    console.log("Views created successfully");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating views", err);
  } finally {
    client.release();
    pool.end();
  }
}

createView();
