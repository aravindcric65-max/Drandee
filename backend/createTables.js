require("dotenv").config();
const { Pool } = require("pg");

// ============================================
// Database Connection
// ============================================

const isLocalDatabase =
  process.env.DATABASE_URL?.includes("localhost") ||
  process.env.DATABASE_URL?.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabase
    ? false
    : {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      },
});

// ============================================
// Create Tables
// ============================================

const createTables = async () => {
  try {
    // Idempotent table creation (non-destructive)

    console.log("\n🔧 Creating Drandee tables...\n");

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        firebase_uid VARCHAR(128) UNIQUE,
        account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'audience',
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        is_protected BOOLEAN DEFAULT false,
        current_badge VARCHAR(100),
        identity_level VARCHAR(50) DEFAULT 'Emerging',
        current_streak INTEGER DEFAULT 0,
        last_active_at TIMESTAMP,
        last_spotlight_at TIMESTAMP,
        avg_dopamine_score FLOAT DEFAULT 0,
        last_dopamine_score FLOAT DEFAULT 0,
        joined_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        username VARCHAR(60),
        bio TEXT,
        profile_pic TEXT,
        gender VARCHAR(50),
        niche JSONB DEFAULT '[]',
        birthday DATE,
        phone VARCHAR(30),
        frame_style VARCHAR(30) DEFAULT 'gradient',
        star_friends JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        favorite_tags JSONB DEFAULT '[]',
        favorite_category VARCHAR(80),
        preferred_video_length INTEGER,
        peak_activity_hour INTEGER,
        avg_watch_session_duration BIGINT DEFAULT 0,
        total_watch_time BIGINT DEFAULT 0,
        current_velocity_score FLOAT DEFAULT 0,
        peak_velocity_24h FLOAT DEFAULT 0,
        avg_velocity_7d FLOAT DEFAULT 0
      )
    `);
    console.log("✅ Users table created");

    // Posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        creator_id INTEGER,
        creator_name VARCHAR(100),
        video_url TEXT,
        image_url TEXT,
        caption TEXT,
        tags TEXT[],
        overlay_text TEXT,
        text_position VARCHAR(20) DEFAULT 'center',
        start_time FLOAT DEFAULT 0,
        end_time FLOAT,
        type VARCHAR(20) DEFAULT 'reel',
        total_respects INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        save_count INTEGER DEFAULT 0,
        total_watch_time BIGINT DEFAULT 0,
        watch_count INTEGER DEFAULT 0,
        avg_completion_rate FLOAT DEFAULT 0,
        region VARCHAR(50) DEFAULT 'local',
        is_deleted BOOLEAN DEFAULT false,
        is_private BOOLEAN DEFAULT false,
        moderation_status VARCHAR(20) DEFAULT 'approved',
        rights_expires_at TIMESTAMP,
        rights_status VARCHAR(50) DEFAULT 'licensed',
        -- Privacy columns (added for Instagram-level Profile System)
        hide_respect_count BOOLEAN NOT NULL DEFAULT false,
        hide_share_count BOOLEAN NOT NULL DEFAULT false,
        comments_enabled BOOLEAN NOT NULL DEFAULT true,
        reuse_enabled BOOLEAN NOT NULL DEFAULT true,
        content_type VARCHAR(20) NOT NULL DEFAULT 'photo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Posts table created");

    // Respects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS respects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);
    console.log("✅ Respects table created");

    // Comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        is_pinned BOOLEAN DEFAULT false
      )
    `);
    console.log("✅ Comments table created");

    // Shares table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        platform VARCHAR(50) DEFAULT 'copy',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Shares table created");

    // Follows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `);
    console.log("✅ Follows table created");

    // Watch sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watch_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        watch_time BIGINT DEFAULT 0,
        video_duration BIGINT DEFAULT 0,
        completion_percent FLOAT DEFAULT 0,
        is_respected BOOLEAN DEFAULT false,
        is_saved BOOLEAN DEFAULT false,
        last_watched_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);
    console.log("✅ Watch sessions table created");

    // Spotlight cycles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spotlight_cycles (
        id SERIAL PRIMARY KEY,
        level VARCHAR(20) UNIQUE NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Spotlight cycles table created");

    // Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Notifications table created");

    // Saved posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);
    console.log("✅ Saved posts table created");

    // Feed experiments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feed_experiments (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        variant VARCHAR(20) NOT NULL DEFAULT 'control',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Feed experiments table created");

    // User blocks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      )
    `);
    console.log("✅ User blocks table created");

    // User mutes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_mutes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        muted_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, muted_id)
      )
    `);
    console.log("✅ User mutes table created");

    // Not interested posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS not_interested_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);
    console.log("✅ Not interested posts table created");

    // Post reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        reason VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(reporter_id, post_id)
      )
    `);
    console.log("✅ Post reports table created");

    // Saved reels table (with collection name support)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_reels (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        collection_name VARCHAR(100) DEFAULT 'Saved',
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);
    console.log("✅ Saved reels table created");

    // User content preferences (hidden categories)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_content_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        hidden_category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, hidden_category)
      )
    `);
    console.log("✅ User content preferences table created");

    // ============================================
    // HOME FEED ARCHITECTURE TABLES
    // ============================================
    
    // User Interests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_interests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        interests JSONB DEFAULT '[]',
        watch_history JSONB DEFAULT '[]',
        session_interests JSONB DEFAULT '[]',
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ User interests table created");

    // Content Feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_feedback (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Content feedback table created");

    // Feed Impressions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feed_impressions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dwell_time BIGINT DEFAULT 0,
        action VARCHAR(50)
      )
    `);
    console.log("✅ Feed impressions table created");

    // Communities table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS communities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        member_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Communities table created");

    // Topics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        post_count INTEGER DEFAULT 0,
        trending BOOLEAN DEFAULT false,
        trending_score FLOAT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Topics table created");


    // ============================================
    // Indexes
    // ============================================

    console.log("\n🔧 Creating indexes...");

    await pool.query(`
      CREATE UNIQUE INDEX users_username_unique_idx
      ON users (username)
      WHERE username IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX watch_sessions_user_post_idx
      ON watch_sessions (user_id, post_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts (user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS posts_creator_id_idx ON posts (creator_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments (post_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS shares_post_id_idx ON shares (post_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS respects_post_id_idx ON respects (post_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON user_blocks (blocker_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS user_mutes_user_idx ON user_mutes (user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS not_interested_user_idx ON not_interested_posts (user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS post_reports_post_idx ON post_reports (post_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS posts_moderation_idx ON posts (is_deleted, moderation_status)
    `);

    console.log("✅ Indexes created");

    console.log("\n🎉 All tables created successfully!");
  } catch (err) {
    console.error("❌ SQL Error:", err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.exit();
  }
};

createTables();