require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log("Starting notifications table migration...");
  try {
    await pool.query(`DROP TABLE IF EXISTS notifications CASCADE;`);
    console.log("Dropped existing notifications table.");

    await pool.query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        actor_name VARCHAR(100),
        actor_avatar TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`CREATE INDEX idx_notif_user_id ON notifications(user_id);`);
    await pool.query(`CREATE INDEX idx_notif_read ON notifications(read);`);
    await pool.query(`CREATE INDEX idx_notif_created_at ON notifications(created_at DESC);`);

    console.log("Successfully created rich notifications table with indexes.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

migrate();
