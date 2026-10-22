require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const u = await client.query("INSERT INTO users (name, username, email, password_hash) VALUES ('test1', 'test_reporter_1', 't1@t.com', 'x') RETURNING id");
    const u2 = await client.query("INSERT INTO users (name, username, email, password_hash) VALUES ('test2', 'test_reporter_2', 't2@t.com', 'x') RETURNING id");
    
    await client.query("INSERT INTO posts (user_id, title) VALUES ($1, 'test post 1') RETURNING id", [u.rows[0].id]);
    await client.query("INSERT INTO posts (user_id, title) VALUES ($1, 'test post 2') RETURNING id", [u.rows[0].id]);
    
    await client.query("COMMIT");
    console.log("Seeded integer test users and posts!");
  } catch(e) {
    console.log("Seed error", e.message);
    await client.query("ROLLBACK");
  } finally {
    client.release();
    pool.end();
  }
}
run();
