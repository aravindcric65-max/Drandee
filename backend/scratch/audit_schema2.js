const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function audit2() {
  try {
    // Check creator_dashboard_view definition
    const viewDef = await pool.query(`SELECT view_definition FROM information_schema.views WHERE table_name = 'creator_dashboard_view'`);
    console.log('\n=== creator_dashboard_view DEFINITION ===');
    console.log(viewDef.rows[0]?.view_definition || 'NOT FOUND');

    const viewDef2 = await pool.query(`SELECT view_definition FROM information_schema.views WHERE table_name = 'creator_daily_analytics_view'`);
    console.log('\n=== creator_daily_analytics_view DEFINITION ===');
    console.log(viewDef2.rows[0]?.view_definition || 'NOT FOUND');

    // creator_earnings columns
    const earnCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='creator_earnings' ORDER BY ordinal_position`);
    console.log('\n=== creator_earnings COLUMNS ===');
    console.log(earnCols.rows.map(r => r.column_name).join(', '));

    // Check shares table
    const shareExists = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='shares' ORDER BY ordinal_position`);
    console.log('\n=== shares COLUMNS ===');
    console.log(shareExists.rows.map(r => r.column_name).join(', '));

    // Check frontend refs to creator endpoints
    console.log('\n=== REDIS_URL reachable?', process.env.REDIS_URL);

    // check antiBot utility
    const fs = require('fs');
    const antiBotExists = fs.existsSync('./utils/antiBot.js');
    console.log('antiBot.js exists:', antiBotExists);

    const evExists = fs.existsSync('./utils/engagementVelocity.js');
    console.log('engagementVelocity.js exists:', evExists);

    // Check if redisClient is exported from antiBot
    if (antiBotExists) {
      const content = fs.readFileSync('./utils/antiBot.js', 'utf8');
      console.log('\nantiBot.js exports:', content.match(/module\.exports/g));
    }

    // Check how evgVelocity exports ensureRedis
    if (evExists) {
      const content = fs.readFileSync('./utils/engagementVelocity.js', 'utf8');
      const exportMatch = content.match(/module\.exports\s*=\s*{[^}]+}/);
      console.log('\nengagementVelocity exports:', exportMatch?.[0]?.slice(0,200));
    }

  } catch (e) {
    console.error('Audit2 error:', e.message);
  } finally {
    await pool.end();
  }
}

audit2();
