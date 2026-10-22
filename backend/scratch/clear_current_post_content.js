const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../config/database');
async function clearContent() {
  console.log("=== PHASE 12.7 CONTENT CLEANUP ===");

  if (process.env.NODE_ENV === 'production') {
    console.error("ABORT: Cannot run cleanup script in production environment.");
    process.exit(1);
  }

  try {
    await pool.query('BEGIN');
    
    // Soft-delete user-created posts only (image, video, text, carousel)
    const res = await pool.query(`
      UPDATE posts
      SET is_deleted = true
      WHERE is_deleted IS NOT TRUE
      AND type IN ('image', 'video', 'text', 'carousel', 'discussion');
    `);
    
    console.log(`Soft deleted ${res.rowCount} posts.`);

    await pool.query('COMMIT');
    console.log("Cleanup completed successfully.");
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error("Cleanup failed:", e.message);
  } finally {
    await pool.end();
  }
}

clearContent();
