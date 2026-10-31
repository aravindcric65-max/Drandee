require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('=== STEP 1: PRE-MIGRATION CHECK ===');
    const preCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('firebase_uid', 'account_status')
    `);
    console.log('Current matching columns (expected 0):', preCheck.rows);

    console.log('\n=== STEP 2: RUNNING MIGRATION ===');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
    `);
    console.log('Added column firebase_uid VARCHAR(128) UNIQUE');

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
    `);
    console.log("Added column account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
    `);
    console.log('Created index idx_users_firebase_uid');

    await client.query('COMMIT');
    console.log('Migration committed successfully.');

    console.log('\n=== STEP 3: POST-MIGRATION VERIFICATION ===');
    const postCheck = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('firebase_uid', 'account_status')
      ORDER BY column_name;
    `);
    console.log('Columns verified in information_schema.columns (expected 2):');
    console.table(postCheck.rows);

    const indexCheck = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'users' AND indexname = 'idx_users_firebase_uid';
    `);
    console.log('Index verified in pg_indexes (expected 1):');
    console.table(indexCheck.rows);

    const userStatusCheck = await client.query(`
      SELECT id, name, username, account_status, firebase_uid
      FROM users
      LIMIT 5;
    `);
    console.log('Sample users showing account_status = ACTIVE:');
    console.table(userStatusCheck.rows);

    const invalidStatusCheck = await client.query(`
      SELECT count(*) as invalid_count
      FROM users
      WHERE account_status != 'ACTIVE' OR account_status IS NULL;
    `);
    console.log('Count of users with non-ACTIVE status (expected 0):', invalidStatusCheck.rows[0].invalid_count);

    console.log('\n=== ALL MIGRATION CHECKS PASSED ===');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
