require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('=== STEP 1: PRE-MIGRATION CHECK ===');
    const preCheck = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name = 'onboarding_completed'
    `);
    if (preCheck.rows.length > 0) {
      console.log('Column already exists:', preCheck.rows[0]);
      console.log('Migration is idempotent — applying anyway.');
    } else {
      console.log('Column onboarding_completed does NOT exist yet — will be added.');
    }

    console.log('\n=== STEP 2: RUNNING MIGRATION ===');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('Applied: ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE');

    await client.query('COMMIT');
    console.log('Migration committed.');

    console.log('\n=== STEP 3: POST-MIGRATION VERIFICATION ===');
    const postCheck = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name = 'onboarding_completed'
    `);
    if (postCheck.rows.length === 0) {
      throw new Error('VERIFICATION FAILED: onboarding_completed column not found after migration');
    }
    console.log('Column verified:');
    console.table(postCheck.rows);

    const sampleCheck = await client.query(`
      SELECT id, username, onboarding_completed
      FROM users
      ORDER BY id
      LIMIT 3
    `);
    console.log('Sample rows (onboarding_completed should be false for existing users):');
    console.table(sampleCheck.rows);

    console.log('\n=== MIGRATION COMPLETE ✅ ===');
    console.log('POST /api/user/onboarding will now succeed.');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Migration FAILED, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
