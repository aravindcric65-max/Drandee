require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    // 1. Add collection_name to saved_posts
    const colCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='saved_posts' AND column_name='collection_name'"
    );
    if (colCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE saved_posts ADD COLUMN collection_name VARCHAR(200) DEFAULT 'Saved'`);
      console.log("Added collection_name to saved_posts");
    } else {
      console.log("collection_name already exists in saved_posts");
    }
    
    // 2. Ensure unique constraint on (user_id, post_id) if not exists
    const conCheck = await pool.query(
      "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='saved_posts' AND constraint_type='UNIQUE'"
    );
    if (conCheck.rows.length === 0) {
      await pool.query(`ALTER TABLE saved_posts ADD CONSTRAINT saved_posts_user_post_unique UNIQUE (user_id, post_id)`);
      console.log("Added UNIQUE constraint to saved_posts(user_id, post_id)");
    } else {
      console.log("UNIQUE constraint already exists on saved_posts:", conCheck.rows.map(r=>r.constraint_name).join(', '));
    }
    
    console.log("Migration complete");
  } catch (e) {
    console.error("Migration ERROR:", e.message, e.detail || '');
  } finally {
    process.exit(0);
  }
}
migrate();
