require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if table already exists
    const checkTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_links'
    `);

    if (checkTable.rows.length === 0) {
      console.log('Creating user_links table...');
      await client.query(`
        CREATE TABLE user_links (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          title VARCHAR(200) NOT NULL,
          url TEXT NOT NULL,
          position INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          clicks INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('user_links table created successfully.');
    } else {
      console.log('user_links table already exists. Checking columns...');

      // Ensure all required columns exist (safe for re-runs)
      const columns = [
        { name: 'position', def: 'INTEGER DEFAULT 0' },
        { name: 'is_active', def: 'BOOLEAN DEFAULT true' },
        { name: 'clicks', def: 'INTEGER DEFAULT 0' },
      ];
      for (const col of columns) {
        const check = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'user_links' AND column_name = $1
        `, [col.name]);
        if (check.rows.length === 0) {
          await client.query(`ALTER TABLE user_links ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`);
          console.log(`Added missing column: ${col.name}`);
        }
      }
      console.log('user_links columns verified.');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
