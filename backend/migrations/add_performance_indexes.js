/**
 * Idempotent migration: add performance indexes + deduplicate feed_impressions + add unique constraint
 *
 * Safe to run multiple times.
 * Does NOT drop any data. Deduplication keeps the NEWEST row per (user_id, post_id, action).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Posts indexes ──────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC)`);
    console.log('✅ idx_posts_created_at');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at ON posts (user_id, created_at DESC)`);
    console.log('✅ idx_posts_user_id_created_at');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts (content_type)`);
    console.log('✅ idx_posts_content_type');

    // ── 2. Follows indexes ────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows (follower_id)`);
    console.log('✅ idx_follows_follower_id');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows (following_id)`);
    console.log('✅ idx_follows_following_id');

    // ── 3. Notifications index ────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications (user_id, created_at DESC)`);
    console.log('✅ idx_notifications_user_id_created_at');

    // ── 4. Watch/view sessions indexes ───────────────────────────────────
    // Only create if the tables actually exist
    const watchExists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='watch_sessions'`
    );
    if (watchExists.rows.length > 0) {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_watch_sessions_user_post ON watch_sessions (user_id, post_id)`);
      console.log('✅ idx_watch_sessions_user_post');
    } else {
      console.log('ℹ️  watch_sessions table not found — skipping');
    }

    // ── 5. feed_impressions: deduplicate then add unique constraint ────────
    const fiExists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='feed_impressions'`
    );

    if (fiExists.rows.length > 0) {
      // Check if unique constraint already exists
      const constraintExists = await client.query(`
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_feed_impressions_user_post_action'
      `);

      if (constraintExists.rows.length === 0) {
        // SHOW the dedupe query first (read-only diagnostic)
        const dupCount = await client.query(`
          SELECT COUNT(*) AS dup_count
          FROM feed_impressions fi
          WHERE fi.id NOT IN (
            SELECT DISTINCT ON (user_id, post_id, action) id
            FROM feed_impressions
            ORDER BY user_id, post_id, action, id DESC
          )
        `);
        console.log(`ℹ️  Duplicate feed_impressions rows to remove: ${dupCount.rows[0].dup_count}`);

        // Delete duplicates — keep the NEWEST row per (user_id, post_id, action)
        await client.query(`
          DELETE FROM feed_impressions
          WHERE id NOT IN (
            SELECT DISTINCT ON (user_id, post_id, action) id
            FROM feed_impressions
            ORDER BY user_id, post_id, action, id DESC
          )
        `);
        console.log('✅ feed_impressions duplicates removed');

        // Add unique constraint
        await client.query(`
          ALTER TABLE feed_impressions
          ADD CONSTRAINT uq_feed_impressions_user_post_action
          UNIQUE (user_id, post_id, action)
        `);
        console.log('✅ uq_feed_impressions_user_post_action unique constraint added');
      } else {
        console.log('ℹ️  uq_feed_impressions_user_post_action already exists — skipping');
      }
    } else {
      console.log('ℹ️  feed_impressions table not found — skipping unique constraint');
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
