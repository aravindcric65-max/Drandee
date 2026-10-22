const { Pool } = require("pg");
const pg = require('pg');
// Type 1114 = TIMESTAMP WITHOUT TIME ZONE
// node-pg parses these as local time by default; treat as UTC to fix the 5.5h offset
pg.types.setTypeParser(1114, (v) => v ? new Date(v.replace(' ', 'T') + 'Z') : null);

// Use environment variable or fallback to local development config
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/drandee_db",
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Increased to 30s for Neon cold start
  statement_timeout: 30000,
  maxUses: 7500,
});

// Add error handler to prevent idle client crashes
pool.on('error', (err, client) => {
  console.error('❌ Unexpected database pool error:', err.message);
  // Don't exit the process, let the pool handle reconnection
});

// Test connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    console.log("💡 Make sure PostgreSQL is running and DATABASE_URL is correct in .env");
  } else {
    console.log("✅ Connected to database");
  }
});

module.exports = { pool };