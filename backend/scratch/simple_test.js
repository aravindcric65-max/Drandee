const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function testConnection() {
  console.log("Testing database connection...");

  const connectionString = process.env.DATABASE_URL;
  console.log("Connection string exists:", !!connectionString);

  if (!connectionString) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
  }

  console.log("Creating pool...");

  try {
    const pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    
    console.log("Pool created, trying to connect...");
    
    const client = await pool.connect();
    console.log("Connected successfully!");
    
    // Simple query to test
    const result = await client.query('SELECT NOW()');
    console.log("Database time:", result.rows[0].now);
    
    client.release();
    await pool.end();
    console.log("Connection closed.");
    
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testConnection();