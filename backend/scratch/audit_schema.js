const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function audit() {
  try {
    // 1. posts columns
    const postCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='posts' ORDER BY ordinal_position`);
    console.log('\n=== POSTS COLUMNS ===');
    console.log(postCols.rows.map(r => r.column_name).join(', '));

    // 2. users columns
    const userCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`);
    console.log('\n=== USERS COLUMNS ===');
    console.log(userCols.rows.map(r => r.column_name).join(', '));

    // 3. follows columns
    const followCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='follows' ORDER BY ordinal_position`);
    console.log('\n=== FOLLOWS COLUMNS ===');
    console.log(followCols.rows.map(r => r.column_name).join(', '));

    // 4. watch_sessions check
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
    console.log('\n=== ALL TABLES ===');
    console.log(tables.rows.map(r => r.table_name).join(', '));

    // 5. check if watch_sessions exists
    const hasSessions = tables.rows.some(r => r.table_name === 'watch_sessions');
    console.log('\n=== watch_sessions exists:', hasSessions);

    // 6. respects table
    const respectExists = tables.rows.some(r => r.table_name === 'respects');
    console.log('=== respects table exists:', respectExists);
    if (respectExists) {
      const respectCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='respects' ORDER BY ordinal_position`);
      console.log('respects columns:', respectCols.rows.map(r => r.column_name).join(', '));
    }

    // 7. comments table
    const commentsExists = tables.rows.some(r => r.table_name === 'comments');
    console.log('=== comments table exists:', commentsExists);
    if (commentsExists) {
      const commentCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='comments' ORDER BY ordinal_position`);
      console.log('comments columns:', commentCols.rows.map(r => r.column_name).join(', '));
    }

    // 8. watch_sessions columns if exists
    if (hasSessions) {
      const sessionCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='watch_sessions' ORDER BY ordinal_position`);
      console.log('\nwatch_sessions columns:', sessionCols.rows.map(r => r.column_name).join(', '));
    }

    // 9. check monetization tables
    const monoTables = ['creator_earnings', 'creator_payout_settings', 'creator_payouts', 'brand_deals', 'brand_deal_applications', 'creator_dashboard_view', 'creator_daily_analytics_view'];
    console.log('\n=== MONETIZATION TABLE CHECK ===');
    for (const t of monoTables) {
      const exists = tables.rows.some(r => r.table_name === t);
      console.log(`  ${t}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    }

    // 10. Redis config
    console.log('\n=== REDIS_URL:', process.env.REDIS_URL || 'NOT SET');
    console.log('=== REDIS_ENABLED:', process.env.REDIS_ENABLED || 'NOT SET');

  } catch (e) {
    console.error('Audit error:', e.message);
  } finally {
    await pool.end();
  }
}

audit();
