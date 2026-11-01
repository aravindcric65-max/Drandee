'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

async function runMigrations() {
  console.log('[MIGRATE] Starting database migrations runner...');

  try {
    // 1. Ensure _migrations tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Query already applied migrations
    const appliedResult = await pool.query('SELECT name FROM _migrations ORDER BY id ASC');
    const appliedNames = new Set(appliedResult.rows.map((r) => r.name));

    // 3. Scan migrations directory
    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[MIGRATE] No migrations directory found at ' + migrationsDir);
      process.exit(0);
    }

    const allFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') || (f.endsWith('.js') && !f.startsWith('run_')))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    let appliedCount = 0;

    for (const file of allFiles) {
      if (appliedNames.has(file)) {
        continue;
      }

      console.log(`[MIGRATE] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);

      if (file.endsWith('.sql')) {
        const sql = fs.readFileSync(filePath, 'utf8');
        await pool.query(sql);
      } else if (file.endsWith('.js')) {
        const migrationModule = require(filePath);
        if (typeof migrationModule === 'function') {
          await migrationModule(pool);
        } else if (migrationModule && typeof migrationModule.up === 'function') {
          await migrationModule.up(pool);
        } else if (migrationModule && typeof migrationModule.migrate === 'function') {
          await migrationModule.migrate(pool);
        }
      }

      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`[MIGRATE] ✓ Applied: ${file}`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('[MIGRATE] Database is up to date. No pending migrations.');
    } else {
      console.log(`[MIGRATE] Successfully applied ${appliedCount} migration(s).`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATE] ✗ Migration failed:', error.message);
    if (error.code) console.error('[MIGRATE] Error code:', error.code);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
