const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../config/database');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        push_enabled BOOLEAN DEFAULT true,
        email_enabled BOOLEAN DEFAULT true,
        respect_enabled BOOLEAN DEFAULT true,
        comment_enabled BOOLEAN DEFAULT true,
        follow_enabled BOOLEAN DEFAULT true,
        mention_enabled BOOLEAN DEFAULT true,
        reply_enabled BOOLEAN DEFAULT true,
        system_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table created");
  } finally {
    pool.end();
  }
}
run();
