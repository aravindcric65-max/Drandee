const express = require("express");
const authMiddleware = require("../middleware/auth");

module.exports = (pool) => {
  const router = express.Router();

  const Redis = require("ioredis");
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  // Rate limiting via Redis (Replaces in-memory Map leak)
  const MAX_ANALYTICS_REQUESTS_PER_MINUTE = 30;
  
  const checkRateLimit = async (userId) => {
    try {
      const key = `rl:analytics:${userId}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 60);
      }
      return current <= MAX_ANALYTICS_REQUESTS_PER_MINUTE;
    } catch (err) {
      console.error("Redis rate limit error:", err);
      return true; // Fail open if Redis is down
    }
  };

  const getTimeRange = (range) => {
    const ranges = {
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
      "all": "all",
    };
    return ranges[range] || "30 days";
  };

  const ALLOWED_RANGES = { "7d": 7, "30d": 30, "90d": 90, "all": null };

  const getDateFilter = (range) => {
    if (!(range in ALLOWED_RANGES)) range = "30d";
    const days = ALLOWED_RANGES[range];
    if (!days) return "";
    return `AND created_at > NOW() - INTERVAL '${days} days'`;
  };

  /*
   * GET /api/analytics/overview - Dashboard summary
   */
  router.get("/overview", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const range = req.query.range || "30d";
      const dateFilter = getDateFilter(range);

      // Rate limit check
      const allowed = await checkRateLimit(userId);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const [
        postCount,
        totalRespects,
        totalComments,
        totalShares,
        followerCount,
        profileViews,
      ] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS count FROM posts WHERE user_id = $1 AND is_deleted = false ${dateFilter}`,
          [userId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(total_respects), 0) AS total FROM posts WHERE user_id = $1 AND is_deleted = false ${dateFilter}`,
          [userId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(comment_count), 0) AS total FROM posts WHERE user_id = $1 AND is_deleted = false ${dateFilter}`,
          [userId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(share_count), 0) AS total FROM posts WHERE user_id = $1 AND is_deleted = false ${dateFilter}`,
          [userId]
        ),
        pool.query(
          `SELECT COUNT(*) AS count FROM follows WHERE following_id = $1`,
          [userId]
        ),
        pool.query(
          `SELECT COUNT(*) AS count FROM profile_views WHERE profile_id = $1 ${dateFilter}`,
          [userId]
        ),
      ]);

      const engagementRate = totalRespects.rows[0].total > 0
        ? ((totalRespects.rows[0].total + totalComments.rows[0].total + totalShares.rows[0].total) / postCount.rows[0].count).toFixed(2)
        : 0;

      return res.json({
        success: true,
        overview: {
          posts: parseInt(postCount.rows[0].count, 10),
          respects: parseInt(totalRespects.rows[0].total, 10),
          comments: parseInt(totalComments.rows[0].total, 10),
          shares: parseInt(totalShares.rows[0].total, 10),
          followers: parseInt(followerCount.rows[0].count, 10),
          profileViews: parseInt(profileViews.rows[0].count, 10),
          engagementRate: parseFloat(engagementRate),
        },
        range,
      });
    } catch (err) {
      console.error("Analytics overview error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/analytics/posts - Post performance metrics
   */
  router.get("/posts", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const range = req.query.range || "30d";
      const dateFilter = getDateFilter(range);

      // Rate limit check
      const allowed = await checkRateLimit(userId);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          content,
          media_url,
          video_url,
          total_respects,
          comment_count,
          share_count,
          watch_count,
          created_at
         FROM posts
         WHERE user_id = $1 AND is_deleted = false ${dateFilter}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const posts = result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        mediaUrl: row.media_url,
        videoUrl: row.video_url,
        respects: row.total_respects,
        comments: row.comment_count,
        shares: row.share_count,
        views: row.watch_count,
        createdAt: row.created_at,
        engagementScore: row.total_respects + row.comment_count * 2 + row.share_count * 3,
      }));

      return res.json({
        success: true,
        posts,
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
        range,
      });
    } catch (err) {
      console.error("Analytics posts error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/analytics/posts/:id - Single post analytics
   */
  router.get("/posts/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const postId = parseInt(req.params.id, 10);

      if (!Number.isInteger(postId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
        });
      }

      const result = await pool.query(
        `SELECT
          p.id,
          p.content,
          p.media_url,
          p.video_url,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.watch_count,
          p.avg_completion_rate,
          p.created_at,
          COUNT(DISTINCT r.user_id) AS unique_respects,
          COUNT(DISTINCT c.id) AS unique_comments
         FROM posts p
         LEFT JOIN respects r ON r.post_id = p.id
         LEFT JOIN comments c ON c.post_id = p.id
         WHERE p.id = $1 AND p.user_id = $2 AND p.is_deleted = false
         GROUP BY p.id`,
        [postId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      const row = result.rows[0];

      return res.json({
        success: true,
        analytics: {
          id: row.id,
          content: row.content,
          mediaUrl: row.media_url,
          videoUrl: row.video_url,
          respects: row.total_respects,
          comments: row.comment_count,
          shares: row.share_count,
          views: row.watch_count,
          avgCompletionRate: row.avg_completion_rate,
          uniqueRespects: parseInt(row.unique_respects, 10),
          uniqueComments: parseInt(row.unique_comments, 10),
          createdAt: row.created_at,
          engagementScore: row.total_respects + row.comment_count * 2 + row.share_count * 3,
        },
      });
    } catch (err) {
      console.error("Single post analytics error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/analytics/audience - Audience demographics & insights
   */
  router.get("/audience", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      // Rate limit check
      const allowed = await checkRateLimit(userId);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const [topLocations, activeTimes, genderSplit] = await Promise.all([
        pool.query(
          `SELECT
            u.location,
            COUNT(*) AS count
           FROM follows f
           JOIN users u ON u.id = f.follower_id
           WHERE f.following_id = $1 AND u.location IS NOT NULL
           GROUP BY u.location
           ORDER BY count DESC
           LIMIT 10`,
          [userId]
        ),
        pool.query(
          `SELECT
            EXTRACT(HOUR FROM created_at) AS hour,
            COUNT(*) AS count
           FROM watch_sessions
           WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1 AND is_deleted = false)
           GROUP BY EXTRACT(HOUR FROM created_at)
           ORDER BY hour`,
          [userId]
        ),
        pool.query(
          `SELECT
            u.gender,
            COUNT(*) AS count
           FROM follows f
           JOIN users u ON u.id = f.follower_id
           WHERE f.following_id = $1 AND u.gender IS NOT NULL
           GROUP BY u.gender`,
          [userId]
        ),
      ]);

      return res.json({
        success: true,
        audience: {
          topLocations: topLocations.rows.map((row) => ({
            location: row.location,
            count: parseInt(row.count, 10),
          })),
          activeTimes: activeTimes.rows.map((row) => ({
            hour: parseInt(row.hour, 10),
            count: parseInt(row.count, 10),
          })),
          genderSplit: genderSplit.rows.map((row) => ({
            gender: row.gender,
            count: parseInt(row.count, 10),
          })),
        },
      });
    } catch (err) {
      console.error("Audience analytics error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/analytics/growth - Follower growth over time
   */
  router.get("/growth", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const range = req.query.range || "30d";
      const VALID_DAYS = { "7d": 7, "30d": 30, "90d": 90 };
      const days = VALID_DAYS[range] || 30;

      // Rate limit check
      const allowed = await checkRateLimit(userId);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          DATE(created_at) AS date,
          COUNT(*) AS count
         FROM follows
         WHERE following_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [userId]
      );

      const growthData = result.rows.map((row) => ({
        date: row.date,
        newFollowers: parseInt(row.count, 10),
      }));

      return res.json({
        success: true,
        growth: growthData,
        range,
      });
    } catch (err) {
      console.error("Growth analytics error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/analytics/engagement - Engagement rate trends
   */
  router.get("/engagement", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const range = req.query.range || "30d";
      const VALID_DAYS = { "7d": 7, "30d": 30, "90d": 90 };
      const days = VALID_DAYS[range] || 30;

      // Rate limit check
      const allowed = await checkRateLimit(userId);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          DATE(p.created_at) AS date,
          COALESCE(SUM(p.total_respects), 0) AS total_respects,
          COALESCE(SUM(p.comment_count), 0) AS total_comments,
          COALESCE(SUM(p.share_count), 0) AS total_shares,
          COUNT(p.id) AS post_count
         FROM posts p
         WHERE p.user_id = $1 AND p.is_deleted = false AND p.created_at > NOW() - INTERVAL '${days} days'
         GROUP BY DATE(p.created_at)
         ORDER BY date`,
        [userId]
      );

      const engagementData = result.rows.map((row) => ({
        date: row.date,
        respects: parseInt(row.total_respects, 10),
        comments: parseInt(row.total_comments, 10),
        shares: parseInt(row.total_shares, 10),
        posts: parseInt(row.post_count, 10),
        engagementRate: row.post_count > 0
          ? ((parseInt(row.total_respects, 10) + parseInt(row.total_comments, 10) + parseInt(row.total_shares, 10)) / row.post_count).toFixed(2)
          : 0,
      }));

      return res.json({
        success: true,
        engagement: engagementData,
        range,
      });
    } catch (err) {
      console.error("Engagement analytics error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/analytics/top-posts - Best performing posts
   */
  router.get("/top-posts", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const range = req.query.range || "30d";
      const dateFilter = getDateFilter(range);

      // Rate limit check
      const allowed = await checkRateLimit(userId);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          content,
          media_url,
          video_url,
          total_respects,
          comment_count,
          share_count,
          watch_count,
          created_at,
          (total_respects + comment_count * 2 + share_count * 3) AS engagement_score
         FROM posts
         WHERE user_id = $1 AND is_deleted = false ${dateFilter}
         ORDER BY engagement_score DESC
         LIMIT $2`,
        [userId, limit]
      );

      const topPosts = result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        mediaUrl: row.media_url,
        videoUrl: row.video_url,
        respects: row.total_respects,
        comments: row.comment_count,
        shares: row.share_count,
        views: row.watch_count,
        engagementScore: parseInt(row.engagement_score, 10),
        createdAt: row.created_at,
      }));

      return res.json({
        success: true,
        topPosts,
        range,
      });
    } catch (err) {
      console.error("Top posts analytics error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};