require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function getDbInfo() {
  const client = await pool.connect();
  try {
    const tableRes = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log('Tables:', tableRes.rows.map(r => r.tablename).join(', '));
    
    const indexRes = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'");
    console.log('Total Indexes:', indexRes.rows.length);
    console.log('Indexes:', indexRes.rows.map(r => r.indexname).join(', '));
    
    const viewRes = await client.query("SELECT viewname FROM pg_views WHERE schemaname = 'public'");
    console.log('Views:', viewRes.rows.map(r => r.viewname).join(', '));
    
    console.log('Pool Max Size:', pool.options.max || 'default');
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

getDbInfo();
