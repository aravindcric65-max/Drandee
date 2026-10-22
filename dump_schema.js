const { pool } = require('./backend/config/database');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

async function dumpSchema() {
  try {
    const tables = ['users', 'posts', 'comments', 'respects', 'saves', 'shares', 'upload_sessions', 'bookmarks'];
    
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(`\n=== Table: ${table} ===`);
      res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
dumpSchema();
