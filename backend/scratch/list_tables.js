require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function listTables() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log(res.rows.map(r => r.table_name));
    
    // Specifically check users table columns
    const usersCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
    console.log("Users Table Columns:", usersCols.rows.map(r => r.column_name));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
listTables();
