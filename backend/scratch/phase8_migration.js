require('dotenv').config();
const { pool } = require('../config/database');

async function runMigration() {
  console.log('Starting Phase 8 Database Migration...');
  try {
    // 1. Add onboarding_completed and interests columns
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
    `);
    console.log('✅ Added onboarding_completed and interests columns.');

    // 2. Check for existing case-insensitive duplicate usernames
    const duplicatesResult = await pool.query(`
      SELECT LOWER(username) as lower_username, COUNT(*) 
      FROM users 
      WHERE username IS NOT NULL AND username != ''
      GROUP BY LOWER(username) 
      HAVING COUNT(*) > 1;
    `);

    if (duplicatesResult.rows.length > 0) {
      console.warn('⚠️ Found case-insensitive duplicate usernames!');
      console.warn(duplicatesResult.rows);
      console.warn('Handling duplicates by appending random string...');
      
      for (const row of duplicatesResult.rows) {
        const lowerUsername = row.lower_username;
        const usersToFix = await pool.query(`SELECT id, username FROM users WHERE LOWER(username) = $1`, [lowerUsername]);
        // keep the first one intact, modify the rest
        for (let i = 1; i < usersToFix.rows.length; i++) {
          const user = usersToFix.rows[i];
          const newUsername = `${user.username}_${Math.random().toString(36).substring(2, 6)}`;
          await pool.query(`UPDATE users SET username = $1 WHERE id = $2`, [newUsername, user.id]);
          console.log(`Updated duplicate username ${user.username} to ${newUsername}`);
        }
      }
    } else {
      console.log('✅ No case-insensitive duplicate usernames found.');
    }

    // 3. Add Unique Index on LOWER(username)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_lower_username_idx ON users (LOWER(username));
    `);
    console.log('✅ Created unique index users_lower_username_idx on LOWER(username).');
    
    console.log('🎉 Phase 8 Database Migration Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  }
}

runMigration();
