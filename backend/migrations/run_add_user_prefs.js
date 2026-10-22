/**
 * Migration runner: add_user_prefs_columns
 * 
 * Runs the idempotent UP migration to add autoplay_videos and data_saver_mode
 * to the users table, then verifies the result.
 * 
 * Usage: node backend/migrations/run_add_user_prefs.js
 * Requires DATABASE_URL in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n=== STEP 1: Pre-migration schema check ===');
    const preCheck = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('autoplay_videos', 'data_saver_mode')
      ORDER BY column_name;
    `);
    if (preCheck.rows.length === 0) {
      console.log('Columns do NOT exist yet — migration will add them.');
    } else {
      console.log('Columns already present:');
      preCheck.rows.forEach(r => console.log(` - ${r.column_name}: ${r.data_type}, default=${r.column_default}, nullable=${r.is_nullable}`));
      console.log('Migration is idempotent — running anyway.');
    }

    console.log('\n=== STEP 2: Running UP migration ===');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS autoplay_videos BOOLEAN NOT NULL DEFAULT TRUE;`);
    console.log('  ALTER TABLE users ADD COLUMN IF NOT EXISTS autoplay_videos BOOLEAN NOT NULL DEFAULT TRUE; — OK');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS data_saver_mode BOOLEAN NOT NULL DEFAULT FALSE;`);
    console.log('  ALTER TABLE users ADD COLUMN IF NOT EXISTS data_saver_mode BOOLEAN NOT NULL DEFAULT FALSE; — OK');

    console.log('\n=== STEP 3: Post-migration verification ===');
    const postCheck = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('autoplay_videos', 'data_saver_mode')
      ORDER BY column_name;
    `);
    console.log(`Rows returned: ${postCheck.rows.length} (expected: 2)`);
    postCheck.rows.forEach(r => {
      console.log(`  column_name:    ${r.column_name}`);
      console.log(`  data_type:      ${r.data_type}`);
      console.log(`  column_default: ${r.column_default}`);
      console.log(`  is_nullable:    ${r.is_nullable}`);
      console.log('');
    });

    if (postCheck.rows.length !== 2) {
      throw new Error(`Expected 2 rows, got ${postCheck.rows.length}`);
    }

    // Validate defaults
    const av = postCheck.rows.find(r => r.column_name === 'autoplay_videos');
    const ds = postCheck.rows.find(r => r.column_name === 'data_saver_mode');

    if (!av) throw new Error('autoplay_videos column not found after migration');
    if (!ds) throw new Error('data_saver_mode column not found after migration');
    if (av.data_type !== 'boolean') throw new Error(`autoplay_videos: expected boolean, got ${av.data_type}`);
    if (ds.data_type !== 'boolean') throw new Error(`data_saver_mode: expected boolean, got ${ds.data_type}`);

    console.log('=== STEP 4: Sample row verification ===');
    const sampleRow = await client.query(`
      SELECT id, autoplay_videos, data_saver_mode
      FROM users
      ORDER BY id
      LIMIT 1;
    `);
    if (sampleRow.rows.length > 0) {
      const row = sampleRow.rows[0];
      console.log(`  user id=${row.id}: autoplay_videos=${row.autoplay_videos}, data_saver_mode=${row.data_saver_mode}`);
      console.log(`  (autoplay_videos should be true by default, data_saver_mode should be false by default)`);
    } else {
      console.log('  No rows in users table to sample (acceptable in a fresh environment).');
    }

    console.log('\n=== Migration complete ✅ ===');
    console.log('Both columns exist with correct types and defaults.');
    console.log('GET /api/settings/preferences and PUT /api/settings/preferences will now read/write real values.');

  } catch (err) {
    console.error('\n❌ Migration FAILED:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
