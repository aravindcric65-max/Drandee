const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { rankFeedPosts } = require("../utils/feedRanker");
const { loadUserSafetyLists, filterCandidates, getSafetyWhereClause } = require("../utils/safetyFilter");
const { getVelocity } = require("../utils/engagementVelocity");
const { formatPost } = require("../models/postModel");

// ────────────────────────────────────────────────────────
// ROUTES
// ────────────────────────────────────────────────────────

router.get("/", authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get("db");
    const userId = req.auth.userId;
    
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    
    // 1. Fetch user profile
    const userQuery = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ success: false, error: "Invalid user session" });
    }
    
    const rawUser = userQuery.rows[0];
    // Map to expected format by feedRanker
    const user = {
      id: rawUser.id,
      name: rawUser.name,
      username: rawUser.username,
      respectedVideos: rawUser.respected_videos || [],
      savedPosts: rawUser.saved_posts || [],
      following: rawUser.following || [],
      watchedPosts: rawUser.watched_posts || [],
      favoriteTags: rawUser.favorite_tags || {},
      favoriteCreators: rawUser.favorite_creators || {},
      favoriteCategories: rawUser.favorite_categories || {},
      preferredVideoLength: rawUser.preferred_video_length || null,
      preferredLanguage: rawUser.preferred_language || null,
      watchSignals: rawUser.watch_signals || []
    };

    // 2. Fetch safety lists
    const userSafetyData = await loadUserSafetyLists(pool, userId);

    // 3. Fetch up to 100 candidate posts with SQL safety filter
    const candidatesQuery = `
      SELECT 
        p.*,
        COALESCE(u.current_badge, 'new') AS creator_badge,
        u.id AS creator_id,
        u.name AS creator_name,
        u.username AS creator_username,
        EXISTS (
          SELECT 1 FROM respects r
          WHERE r.post_id = p.id AND r.user_id = $1
        ) AS has_respected,
        EXISTS (
          SELECT 1 FROM saved_posts sp
          WHERE sp.post_id = p.id AND sp.user_id = $1
        ) AS has_saved
      FROM posts p
      LEFT JOIN users u ON COALESCE(p.user_id, p.creator_id) = u.id
      WHERE 1=1
        ${getSafetyWhereClause()}
      ORDER BY p.created_at DESC
      LIMIT 100
    `;
    
    let candidatesResult;
    try {
      candidatesResult = await pool.query(candidatesQuery, [userId]);
    } catch (error) {
      console.error('Feed DB error:', error);
      // Return empty feed instead of 500
      return res.json({
        success: true,
        posts: [],
        pagination: { limit, offset, count: 0, hasMore: false }
      });
    }
    let candidates = candidatesResult.rows;

    // 4. Apply post-query safety filters
    candidates = filterCandidates(candidates, userSafetyData);

    if (candidates.length === 0) {
      return res.json({
        success: true,
        posts: [],
        pagination: {
          limit,
          offset,
          count: 0,
          hasMore: false
        }
      });
    }

    // Use formatPost for consistent content_type normalization
    candidates = candidates.map(formatPost);

    // 5. Get user velocity from Redis
    const velocity = await getVelocity(userId);
    user.velocity = velocity;

    // 6. Call rankFeedPosts
    const rankedPosts = await rankFeedPosts(candidates, user, limit, { 
      includeDebugScore: false, 
      allowRewatch: true 
    });

    // 7. Strip proprietary ranking metadata before sending to client
    const sanitizedPosts = rankedPosts.map(post => {
      const { finalScore, scoreBreakdown, velocity, baseScore, ...safePost } = post;
      return safePost;
    });

    return res.json({
      success: true,
      posts: sanitizedPosts,
      pagination: {
        limit,
        offset,
        count: sanitizedPosts.length,
        hasMore: candidates.length === 100
      }
    });
  } catch (error) {
    console.error("GET /feed error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to load feed",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// WebSocket endpoint for realtime updates
router.get("/stream", async (req, res) => {
  res.json({
    success: true,
    message: "WebSocket endpoint for realtime feed updates",
    endpoint: "/ws/feed"
  });
});

module.exports = router;