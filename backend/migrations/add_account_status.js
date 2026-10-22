require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if account_status already exists
    const checkCol = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'account_status'
    `);

    if (checkCol.rows.length === 0) {
      console.log('Adding account_status column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN account_status VARCHAR NOT NULL DEFAULT 'ACTIVE'
      `);
      console.log('Successfully added account_status column.');
    } else {
      console.log('account_status column already exists. Skipping migration.');
    }
    
    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
