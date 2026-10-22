require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spotlight_feedback (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      categories TEXT[] DEFAULT ARRAY[]::TEXT[],
      feedback_text TEXT CHECK (char_length(feedback_text) <= 500),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spotlight_notifications (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      email TEXT,
      notified BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_spotlight_feedback_user ON spotlight_feedback(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_spotlight_notifications_user ON spotlight_notifications(user_id);`);
  console.log('✅ Spotlight schema migration complete!');
  await pool.end();
}

run().catch(err => { console.error('❌ Migration failed:', err); process.exit(1); });
