require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  let initialCount = 0;
  
  try {
    // 1. Pre-migration check
    const countRes = await client.query('SELECT count(*) FROM comment_likes');
    initialCount = parseInt(countRes.rows[0].count, 10);
    console.log(`Pre-migration comment_likes count: ${initialCount}`);

    await client.query('BEGIN');

    // 2. Rename tables and columns safely
    await client.query('ALTER TABLE comment_likes RENAME TO comment_respects');
    
    // Check if like_count exists on comments before renaming
    const colCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='comments' AND column_name='like_count'
    `);
    
    if (colCheck.rows.length > 0) {
      await client.query('ALTER TABLE comments RENAME COLUMN like_count TO respect_count');
      console.log('Renamed comments.like_count -> respect_count');
    }

    // 3. Rename Constraints and Indexes safely if they exist
    const idxCheck1 = await client.query(`SELECT 1 FROM pg_class WHERE relname='comment_likes_pkey'`);
    if (idxCheck1.rows.length > 0) {
      await client.query('ALTER INDEX comment_likes_pkey RENAME TO comment_respects_pkey');
    }

    const idxCheck2 = await client.query(`SELECT 1 FROM pg_class WHERE relname='comment_likes_user_id_comment_id_key'`);
    if (idxCheck2.rows.length > 0) {
      await client.query('ALTER INDEX comment_likes_user_id_comment_id_key RENAME TO comment_respects_user_id_comment_id_key');
    }

    // 4. Drop dead columns (uploads.likes, videos.likes) safely
    const upColCheck = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='uploads' AND column_name='likes'`);
    if (upColCheck.rows.length > 0) {
      await client.query('ALTER TABLE uploads DROP COLUMN likes');
      console.log('Dropped dead column uploads.likes');
    }

    const vidColCheck = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='likes'`);
    if (vidColCheck.rows.length > 0) {
      await client.query('ALTER TABLE videos DROP COLUMN likes');
      console.log('Dropped dead column videos.likes');
    }

    // 5. Post-migration check
    const postCountRes = await client.query('SELECT count(*) FROM comment_respects');
    const finalCount = parseInt(postCountRes.rows[0].count, 10);
    console.log(`Post-migration comment_respects count: ${finalCount}`);

    if (initialCount !== finalCount) {
      throw new Error(`DATA LOSS DETECTED: Initial ${initialCount} !== Final ${finalCount}`);
    }

    await client.query('COMMIT');
    console.log('SUCCESS: Migration committed safely.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('MIGRATION FAILED - ROLLED BACK:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
