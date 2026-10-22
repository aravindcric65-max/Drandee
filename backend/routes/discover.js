const express = require("express");
const authMiddleware = require("../middleware/auth");
const { formatPost } = require("../models/postModel");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_DISCOVER_REQUESTS_PER_MINUTE: 60,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_DISCOVER_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const formatCreator = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    avatar: row.avatar_url,
    bio: row.bio,
    followerCount: parseInt(row.follower_count || 0, 10),
    postCount: parseInt(row.post_count || 0, 10),
    isVerified: row.is_verified,
  });

  const formatHashtag = (row) => ({
    id: row.id,
    tag: row.tag,
    postCount: row.post_count,
    velocityScore: row.velocity_score,
    trendingRank: row.trending_rank,
  });

  /*
   * GET /api/discover/trending - Trending posts (global)
   */
  router.get("/trending", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const category = req.query.category || null;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let query = `
        SELECT
          p.id,
          p.user_id,
          u.name AS user_name,
          u.profile_pic AS user_avatar,
          p.content,
          p.media_url,
          p.video_url,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.watch_count,
          p.velocity_score,
          p.created_at
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.is_deleted = FALSE
          AND p.created_at > NOW() - INTERVAL '7 days'
      `;

      const params = [];

      if (category) {
        query += ` AND p.category = $${params.length + 1}`;
        params.push(category);
      }

      query += `
        ORDER BY p.velocity_score DESC, p.total_respects DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        posts: result.rows.map(formatPost),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
        type: "trending",
      });
    } catch (err) {
      console.error("Get trending error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/discover/hashtags - Trending hashtags
   */
  router.get("/hashtags", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          tag,
          post_count,
          velocity_score,
          trending_rank
         FROM hashtags
         WHERE post_count > 0
         ORDER BY velocity_score DESC, post_count DESC
         LIMIT $1`,
        [limit]
      );

      return res.json({
        success: true,
        hashtags: result.rows.map(formatHashtag),
      });
    } catch (err) {
      console.error("Get trending hashtags error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/discover/creators - Suggested creators
   */
  router.get("/creators", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const type = req.query.type || "emerging"; // emerging, similar, top

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let query;
      const params = [userId, limit];

      if (type === "emerging") {
        // Emerging creators (good engagement, smaller following)
        query = `
          SELECT
            u.id,
            u.name,
            u.username,
            u.profile_pic AS avatar_url,
            u.bio,
            u.is_verified,
            COALESCE(fc.follower_count, 0) AS follower_count,
            COALESCE(pc.post_count, 0) AS post_count
          FROM users u
          LEFT JOIN (
            SELECT following_id, COUNT(*) AS follower_count FROM follows GROUP BY following_id
          ) fc ON fc.following_id = u.id
          LEFT JOIN (
            SELECT user_id, COUNT(*) AS post_count FROM posts WHERE is_deleted = false GROUP BY user_id
          ) pc ON pc.user_id = u.id
          WHERE u.id != $1
            AND u.account_status = 'ACTIVE'
          ORDER BY COALESCE(fc.follower_count, 0) ASC
          LIMIT $2
        `;
      } else if (type === "top") {
        // Top creators (high follower count)
        query = `
          SELECT
            u.id,
            u.name,
            u.username,
            u.profile_pic AS avatar_url,
            u.bio,
            u.is_verified,
            COALESCE(fc.follower_count, 0) AS follower_count,
            COALESCE(pc.post_count, 0) AS post_count
          FROM users u
          LEFT JOIN (
            SELECT following_id, COUNT(*) AS follower_count FROM follows GROUP BY following_id
          ) fc ON fc.following_id = u.id
          LEFT JOIN (
            SELECT user_id, COUNT(*) AS post_count FROM posts WHERE is_deleted = false GROUP BY user_id
          ) pc ON pc.user_id = u.id
          WHERE u.id != $1
            AND u.account_status = 'ACTIVE'
          ORDER BY COALESCE(fc.follower_count, 0) DESC
          LIMIT $2
        `;
      } else {
        // Suggested creators
        query = `
          SELECT
            u.id,
            u.name,
            u.username,
            u.profile_pic AS avatar_url,
            u.bio,
            u.is_verified,
            COALESCE(fc.follower_count, 0) AS follower_count,
            COALESCE(pc.post_count, 0) AS post_count
          FROM users u
          LEFT JOIN (
            SELECT following_id, COUNT(*) AS follower_count FROM follows GROUP BY following_id
          ) fc ON fc.following_id = u.id
          LEFT JOIN (
            SELECT user_id, COUNT(*) AS post_count FROM posts WHERE is_deleted = false GROUP BY user_id
          ) pc ON pc.user_id = u.id
          WHERE u.id != $1
            AND u.account_status = 'ACTIVE'
          ORDER BY u.id DESC
          LIMIT $2
        `;
      }

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        creators: result.rows.map(formatCreator),
        type,
      });
    } catch (err) {
      console.error("Get creators error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/discover/categories - Browse by category
   */
  router.get("/categories", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const category = req.query.category || null;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const validCategories = [
        "sports",
        "music",
        "comedy",
        "education",
        "gaming",
        "food",
        "travel",
        "tech",
        "fashion",
        "fitness",
      ];

      if (category && !validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category",
        });
      }

      let query = `
        SELECT
          p.id,
          p.user_id,
          u.name AS user_name,
          u.profile_pic AS user_avatar,
          p.content,
          p.media_url,
          p.video_url,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.watch_count,
          p.category,
          p.created_at
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.is_deleted = FALSE
      `;

      const params = [];

      if (category) {
        query += ` AND p.category = $${params.length + 1}`;
        params.push(category);
      }

      query += `
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        posts: result.rows.map(formatPost),
        category: category || "all",
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get categories error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/discover/new - New & rising content
   */
  router.get("/new", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          p.id,
          p.user_id,
          u.name AS user_name,
          u.profile_pic AS user_avatar,
          p.content,
          p.media_url,
          p.video_url,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.watch_count,
          p.velocity_score,
          p.created_at
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.is_deleted = FALSE
          AND p.created_at > NOW() - INTERVAL '24 hours'
          AND p.user_id NOT IN (
            SELECT following_id FROM follows WHERE follower_id = $1
          )
        ORDER BY p.velocity_score DESC, p.created_at DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return res.json({
        success: true,
        posts: result.rows.map(formatPost),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
        type: "new",
      });
    } catch (err) {
      console.error("Get new content error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/discover/location - Nearby trending content (optional)
   */
  router.get("/location", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { lat, lon, radius } = req.query;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!lat || !lon) {
        return res.json({
          success: true,
          posts: [],
          message: "Location not provided",
        });
      }

      // Placeholder - in production, use PostGIS for location queries
      const result = await pool.query(
        `SELECT
          p.id,
          p.user_id,
          u.name AS user_name,
          u.profile_pic AS user_avatar,
          p.content,
          p.media_url,
          p.video_url,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.watch_count,
          p.created_at
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.is_deleted = FALSE
          AND p.user_location IS NOT NULL
        ORDER BY p.created_at DESC
        LIMIT $1`,
        [limit]
      );

      return res.json({
        success: true,
        posts: result.rows.map(formatPost),
        location: { lat, lon, radius: radius || 50 },
      });
    } catch (err) {
      console.error("Get location content error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/discover/for-you - Algorithmic "For You" feed (uses existing algorithm)
   */
  router.get("/for-you", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      // This uses the existing feed algorithm from feedRanker.js
      // Just a different endpoint for discover tab
      const result = await pool.query(
        `SELECT
          p.id,
          p.user_id,
          u.name AS user_name,
          u.profile_pic AS user_avatar,
          p.content,
          p.media_url,
          p.video_url,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.watch_count,
          p.velocity_score,
          p.created_at
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.is_deleted = FALSE
          AND p.user_id != $1
        ORDER BY p.velocity_score DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return res.json({
        success: true,
        posts: result.rows.map(formatPost),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
        type: "for-you",
      });
    } catch (err) {
      console.error("Get for-you error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};