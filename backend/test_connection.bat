@echo off
echo Testing Database Connection for Phase 12.7 Migration
echo ===================================================
echo.

echo Checking environment variables...
if "%DATABASE_URL%"=="" (
    echo DATABASE_URL is not set in environment
    echo Checking .env file...
) else (
    echo DATABASE_URL is set in environment
)

echo.
echo Testing connection to Neon PostgreSQL database...
echo.

REM Try to connect using Node.js test script
node -e "
const { Pool } = require('pg');
require('dotenv').config();

console.log('Testing database connection...');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.log('');
    console.log('Troubleshooting steps:');
    console.log('1. Check your internet connection');
    console.log('2. Verify DATABASE_URL in .env file');
    console.log('3. Check if Neon database is active');
    console.log('4. Try running the SQL commands manually');
  } else {
    console.log('✅ Connection successful');
    console.log('Database time:', res.rows[0].now);
  }
  pool.end();
});

setTimeout(() => {
  console.log('Timeout - connection may be hanging');
  process.exit(1);
}, 10000);
"

echo.
echo If connection test fails, please run the migration manually.
echo See MIGRATION_INSTRUCTIONS.md for detailed steps.
echo.
pause