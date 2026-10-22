require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. privacy_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS privacy_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        private_account BOOLEAN DEFAULT FALSE,
        messaging_control VARCHAR(20) DEFAULT 'EVERYONE',
        comments_control VARCHAR(20) DEFAULT 'EVERYONE',
        mentions_control VARCHAR(20) DEFAULT 'EVERYONE',
        tags_control VARCHAR(20) DEFAULT 'EVERYONE',
        activity_visibility BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('Created privacy_settings');

    // 2. auth_sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) UNIQUE NOT NULL,
        device VARCHAR(100),
        browser VARCHAR(100),
        platform VARCHAR(100),
        ip_address VARCHAR(45),
        last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('Created auth_sessions');

    // 3. login_history
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50),
        status VARCHAR(20),
        device VARCHAR(100),
        browser VARCHAR(100),
        platform VARCHAR(100),
        ip_address VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('Created login_history');

    // 4. data_export_jobs
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_export_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'QUEUED',
        file_url TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('Created data_export_jobs');

    // 5. account_deletion_requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'PENDING',
        scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('Created account_deletion_requests');

    await client.query('COMMIT');
    console.log('SUCCESS: Phase 3B Database Schema migrations applied.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('MIGRATION FAILED:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
