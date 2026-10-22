require("dotenv").config();
const { Pool } = require("pg");

const isLocalDatabase =
  process.env.DATABASE_URL?.includes("localhost") ||
  process.env.DATABASE_URL?.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabase
    ? false
    : {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      },
});

const applyConstraint = async () => {
  try {
    console.log("Applying unique constraint to reports table...");
    
    // 1. Remove duplicate reports safely first (keep the oldest)
    await pool.query(`
      DELETE FROM reports
      WHERE id IN (
        SELECT id
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER( PARTITION BY reporter_id, target_type, target_id
                                    ORDER BY created_at ASC ) as row_num
          FROM reports
          WHERE status = 'pending'
        ) t
        WHERE t.row_num > 1
      )
    `);

    // 2. Add the unique constraint
    // Note: Postgres cannot create concurrent indexes in a transaction, so we just run it directly.
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_active_report_idx 
      ON reports (reporter_id, target_type, target_id) 
      WHERE status = 'pending';
    `);

    console.log("✅ Reports duplicate constraint applied successfully.");
  } catch (err) {
    console.error("❌ Migration error:", err);
  } finally {
    pool.end();
  }
};

applyConstraint();
