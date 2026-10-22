const express = require("express");
const authMiddleware = require("../middleware/auth");
const { formatPost } = require("../models/postModel");
const { normalizeMediaUrl } = require("../utils/mediaUrl");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_SEARCH_REQUESTS_PER_MINUTE: 60,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_SEARCH_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const sanitizeQuery = (query) => {
    if (!query || typeof query !== "string") {
      return "";
    }
    return query.trim().slice(0, 100);
  };

  const toPositiveInteger = (value, fallback = 0) => {
    const result = parseInt(value, 10);
    return Number.isInteger(result) && result >= 0 ? result : fallback;
  };

  const formatUser = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    avatar: normalizeMediaUrl(row.avatar_url),
    bio: row.bio,
    followerCount: parseInt(row.follower_count || 0, 10),
    isVerified: row.is_verified,
  });

  const formatHashtag = (row) => ({
    id: row.id,
    tag: row.tag,
    postCount: row.post_count,
    trendingScore: row.trending_score,
  });

  /*
   * GET /api/search/posts - Search posts
   */
  router.get("/posts", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const query = sanitizeQuery(req.query.q);
      const limit = Math.min(toPositiveInteger(req.query.limit) || 20, 100);
      const offset = toPositiveInteger(req.query.offset) || 0;
      const type = req.query.type || "all"; // all, video, image, text
      const sortBy = req.query.sort || "relevance"; // relevance, recent, popular

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Search query required",
        });
      }

      const params = [`%${query}%`, userId];
      let whereClause = `
        AND p.is_deleted = false
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE ub.blocker_id = $2 AND ub.blocked_id = p.user_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks ub2
          WHERE ub2.blocker_id = p.user_id AND ub2.blocked_id = $2
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_mutes um
          WHERE um.user_id = $2 AND um.muted_id = p.user_id
        )
      `;

      // Type filter
      if (type === "video") {
        whereClause += ` AND p.video_url IS NOT NULL`;
      } else if (type === "image") {
        whereClause += ` AND p.media_url IS NOT NULL AND p.video_url IS NULL`;
      } else if (type === "text") {
        whereClause += ` AND p.media_url IS NULL AND p.video_url IS NULL`;
      }

      // Sort order
      let orderBy = "ts_rank DESC";
      if (sortBy === "recent") {
        orderBy = "p.created_at DESC";
      } else if (sortBy === "popular") {
        orderBy = "p.total_respects DESC";
      }

      const searchQuery = `
        SELECT
          p.id,
          p.user_id,
          u.name AS creator_name,
          u.username AS creator_username,
          u.profile_pic AS creator_avatar,
          p.caption,
          p.video_url,
          p.image_url,
          p.tags,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.created_at,
          ts_rank_cd(
            to_tsvector('english', COALESCE(p.caption, '') || ' ' || COALESCE(p.overlay_text, '')),
            plainto_tsquery('english', $1)
          ) AS ts_rank
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        WHERE (p.caption ILIKE $1 OR p.overlay_text ILIKE $1 OR p.tags::text ILIKE $1)
          ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(limit, offset);

      const result = await pool.query(searchQuery, params);

      // Log search query (async, best-effort)
      pool.query(
        `INSERT INTO search_queries (user_id, query, result_count, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, query, result.rows.length]
      ).catch(() => {
        // search_queries table may not exist — ignore silently
      });

      return res.json({
        success: true,
        posts: result.rows.map(formatPost),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
        query,
        type,
        sortBy,
      });
    } catch (err) {
      console.error("Search posts error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/search/users - Search users
   */
  router.get("/users", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const query = sanitizeQuery(req.query.q);
      const limit = Math.min(toPositiveInteger(req.query.limit) || 20, 100);
      const offset = toPositiveInteger(req.query.offset) || 0;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Search query required",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          name,
          username,
          profile_pic AS avatar_url,
          bio,
          is_verified
         FROM users
         WHERE (name ILIKE $1 OR username ILIKE $1)
           AND id != $2
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE ub.blocker_id = $2 AND ub.blocked_id = users.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub2
             WHERE ub2.blocker_id = users.id AND ub2.blocked_id = $2
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_mutes um
             WHERE um.user_id = $2 AND um.muted_id = users.id
           )
         ORDER BY id DESC
         LIMIT $3 OFFSET $4`,
        [`%${query}%`, userId, limit, offset]
      );

      return res.json({
        success: true,
        users: result.rows.map(formatUser),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
        query,
      });
    } catch (err) {
      console.error("Search users error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/search/hashtags - Search hashtags
   */
  router.get("/hashtags", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const query = sanitizeQuery(req.query.q);
      const limit = Math.min(toPositiveInteger(req.query.limit) || 20, 100);
      const offset = toPositiveInteger(req.query.offset) || 0;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Search query required",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          tag,
          post_count,
          trending_score
         FROM hashtags
         WHERE tag ILIKE $1
         ORDER BY trending_score DESC, post_count DESC
         LIMIT $2 OFFSET $3`,
        [`%${query}%`, limit, offset]
      );

      return res.json({
        success: true,
        hashtags: result.rows.map(formatHashtag),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
        query,
      });
    } catch (err) {
      console.error("Search hashtags error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/search/suggestions - Autocomplete suggestions
   */
  router.get("/suggestions", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const query = sanitizeQuery(req.query.q);
      const limit = Math.min(toPositiveInteger(req.query.limit) || 10, 20);

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!query || query.length < 2) {
        return res.json({
          success: true,
          suggestions: [],
          query,
        });
      }

      // Get suggestions from multiple sources
      const [users, hashtags, recent] = await Promise.all([
        pool.query(
          `SELECT name, username, profile_pic AS avatar_url, 'user' AS type
           FROM users
           WHERE (name ILIKE $1 OR username ILIKE $1)
           ORDER BY id DESC
           LIMIT $2`,
          [`${query}%`, limit]
        ),
        pool.query(
          `SELECT tag, 'hashtag' AS type
           FROM hashtags
           WHERE tag ILIKE $1
           ORDER BY trending_score DESC
           LIMIT $2`,
          [`${query}%`, limit]
        ).catch(() => ({ rows: [] })),
        // search_queries table may not exist — degrade gracefully
        pool.query(
          `SELECT query AS text, 'recent' AS type
           FROM search_queries
           WHERE user_id = $1 AND query ILIKE $2
           ORDER BY created_at DESC
           LIMIT $3`,
          [userId, `${query}%`, limit]
        ).catch(() => ({ rows: [] })),
      ]);

      const suggestions = [
        ...users.rows.map((row) => ({
          type: "user",
          text: row.name,
          subtext: `@${row.username}`,
          avatar: row.avatar_url,
        })),
        ...hashtags.rows.map((row) => ({
          type: "hashtag",
          text: `#${row.tag}`,
          subtext: "Hashtag",
        })),
        ...recent.rows.map((row) => ({
          type: "recent",
          text: row.text,
          subtext: "Recent search",
        })),
      ].slice(0, limit);

      return res.json({
        success: true,
        suggestions,
        query,
      });
    } catch (err) {
      console.error("Search suggestions error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/search/trending - Trending searches
   */
  router.get("/trending", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(toPositiveInteger(req.query.limit) || 10, 20);

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let trending = [];
      try {
        const result = await pool.query(
          `SELECT
            query,
            COUNT(*) AS search_count,
            COUNT(DISTINCT user_id) AS user_count
           FROM search_queries
           WHERE created_at > NOW() - INTERVAL '24 hours'
           GROUP BY query
           ORDER BY search_count DESC, user_count DESC
           LIMIT $1`,
          [limit]
        );
        trending = result.rows.map((row) => ({
          query: row.query,
          searchCount: parseInt(row.search_count, 10),
          userCount: parseInt(row.user_count, 10),
        }));
      } catch (_) {
        // search_queries table may not exist — return empty trending list
      }

      return res.json({
        success: true,
        trending,
      });
    } catch (err) {
      console.error("Trending searches error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/search/log - Log search query (analytics)
   */
  router.post("/log", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { query, resultCount, clickedPostId } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: "query required",
        });
      }

      // Best-effort analytics: search_queries table may not exist yet
      pool.query(
        `INSERT INTO search_queries (
          user_id,
          query,
          result_count,
          clicked_post_id,
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW())`,
        [userId, query, resultCount || 0, clickedPostId || null]
      ).catch(() => {});

      return res.json({
        success: true,
      });
    } catch (err) {
      console.error("Search log error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};