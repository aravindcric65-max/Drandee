const express = require('express');
const authMiddleware = require('../middleware/auth');
const { checkRateLimit } = require('../utils/engagementVelocity');
const { logger } = require('../utils/logger'); // assuming logger exists

module.exports = (pool) => {
  const router = express.Router();

  // Helper for rate limiting (30 requests/minute/user)
  const applyRateLimit = async (req, res, next) => {
    try {
      const userId = req.auth.userId;
      const client = await require('../utils/engagementVelocity').ensureRedis();
      if (!client) return next(); // fallback if redis is down

      const key = `rate:creator_api:${userId}`;
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, 60);
      }

      if (count > 30) {
        return res.status(429).json({ error: 'Too many requests. Please slow down.' });
      }

      next();
    } catch (error) {
      // Fail open according to standard rate limit fallbacks
      console.error('Rate limit error:', error.message);
      next();
    }
  };

  // 1. Dashboard
  router.get('/dashboard', authMiddleware, applyRateLimit, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const range = req.query.range || '30d';
      const days = range === '90d' ? 90 : range === '7d' ? 7 : 30;

      // Real metrics for the authenticated creator (excluding deleted posts)
      const dashboardRes = await pool.query(`
        SELECT 
          COUNT(id) AS post_count,
          COALESCE(SUM(total_respects), 0) AS total_respects,
          COALESCE(SUM(comment_count), 0) AS total_comments,
          COALESCE(SUM(share_count), 0) AS total_shares,
          COALESCE(SUM(watch_count), 0) AS total_views,
          COALESCE(AVG(avg_completion_rate), 0) AS retention_rate
        FROM posts
        WHERE user_id = $1 
          AND is_deleted = false 
          AND created_at >= NOW() - ($2::text || ' days')::interval
      `, [userId, days]);

      const followsRes = await pool.query(`
        SELECT COUNT(id) AS follower_count 
        FROM follows 
        WHERE following_id = $1
      `, [userId]);

      const userRes = await pool.query(`
        SELECT peak_velocity_24h FROM users WHERE id = $1
      `, [userId]);

      const typeRes = await pool.query(`
        SELECT 
          type, 
          COUNT(id) AS post_count,
          COALESCE(SUM(total_respects + comment_count * 2 + share_count * 3), 0) as engagement
        FROM posts
        WHERE user_id = $1 
          AND is_deleted = false 
          AND created_at >= NOW() - ($2::text || ' days')::interval
        GROUP BY type
      `, [userId, days]);

      const stats = dashboardRes.rows[0] || { post_count: 0, total_respects: 0, total_comments: 0, total_shares: 0, total_views: 0, retention_rate: 0 };
      const followersCount = parseInt(followsRes.rows[0]?.follower_count || 0, 10);
      const peakVelocity = parseFloat(userRes.rows[0]?.peak_velocity_24h || 0);
      
      const respects = parseInt(stats.total_respects, 10);
      const comments = parseInt(stats.total_comments, 10);
      const shares = parseInt(stats.total_shares, 10);
      const views = parseInt(stats.total_views, 10);
      const posts = parseInt(stats.post_count, 10);
      const retentionRate = parseFloat(stats.retention_rate).toFixed(1);
      
      const engagementByType = typeRes.rows.map(r => ({
        type: r.type || 'standard',
        posts: parseInt(r.post_count, 10),
        engagement: parseInt(r.engagement, 10)
      }));

      const totalEngagement = respects + comments + shares;
      let engagementRate = 0;
      if (views > 0) {
        engagementRate = parseFloat(((totalEngagement / views) * 100).toFixed(2));
      }

      return res.json({
        dashboard: {
          posts,
          respects,
          comments,
          shares,
          views,
          followers: followersCount,
          engagementRate,
          peakVelocity,
          retentionRate,
          engagementByType,
          reach: views // Approximate reach as total views for now
        }
      });
    } catch (error) {
      console.error('Creator Dashboard Error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
  });

  // 2. Analytics Trend
  router.get('/analytics', authMiddleware, applyRateLimit, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const range = req.query.range || '30d';
      const days = range === '90d' ? 90 : range === '7d' ? 7 : 30;

      const result = await pool.query(`
        SELECT 
          DATE(created_at) AS date,
          COUNT(id) AS posts,
          COALESCE(SUM(total_respects), 0) AS respects,
          COALESCE(SUM(comment_count), 0) AS comments,
          COALESCE(SUM(share_count), 0) AS shares,
          COALESCE(SUM(watch_count), 0) AS views
        FROM posts
        WHERE user_id = $1 
          AND is_deleted = false 
          AND created_at >= NOW() - ($2::text || ' days')::interval
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [userId, days]);

      return res.json({
        analytics: result.rows.map(row => ({
          date: row.date,
          posts: parseInt(row.posts, 10),
          respects: parseInt(row.respects, 10),
          comments: parseInt(row.comments, 10),
          shares: parseInt(row.shares, 10),
          views: parseInt(row.views, 10)
        }))
      });
    } catch (error) {
      console.error('Creator Analytics Error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // 3. Top Posts
  router.get('/top-posts', authMiddleware, applyRateLimit, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const range = req.query.range || '30d';
      const days = range === '90d' ? 90 : range === '7d' ? 7 : 30;
      let limit = parseInt(req.query.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 50) limit = 10;

      // Engagement Score Formula: 
      // (Respects * 1) + (Comments * 2) + (Shares * 3)
      const result = await pool.query(`
        SELECT 
          id,
          caption,
          type AS "contentType",
          image_url,
          video_url,
          total_respects AS respects,
          comment_count AS comments,
          share_count AS shares,
          watch_count AS views,
          created_at AS "createdAt",
          (total_respects * 1 + comment_count * 2 + share_count * 3) AS "engagementScore"
        FROM posts
        WHERE user_id = $1 
          AND is_deleted = false 
          AND created_at >= NOW() - ($2::text || ' days')::interval
        ORDER BY "engagementScore" DESC, created_at DESC
        LIMIT $3
      `, [userId, days, limit]);

      return res.json({
        topPosts: result.rows.map(row => ({
          id: row.id,
          caption: row.caption || '',
          contentType: row.contentType,
          mediaUrl: row.video_url || row.image_url || null,
          respects: parseInt(row.respects, 10),
          comments: parseInt(row.comments, 10),
          shares: parseInt(row.shares, 10),
          views: parseInt(row.views, 10),
          engagementScore: parseInt(row.engagementScore, 10),
          createdAt: row.createdAt
        }))
      });
    } catch (error) {
      console.error('Creator Top Posts Error:', error);
      res.status(500).json({ error: 'Failed to fetch top posts' });
    }
  });

  // 4. Audience
  router.get('/audience', authMiddleware, applyRateLimit, async (req, res) => {
    try {
      const userId = req.auth.userId;

      const followersRes = await pool.query(`
        SELECT COUNT(id) AS total_followers 
        FROM follows 
        WHERE following_id = $1
      `, [userId]);

      const followers30dRes = await pool.query(`
        SELECT COUNT(id) AS new_followers 
        FROM follows 
        WHERE following_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      `, [userId]);

      const totalFollowers = parseInt(followersRes.rows[0]?.total_followers || 0, 10);
      const newFollowers = parseInt(followers30dRes.rows[0]?.new_followers || 0, 10);
      const followerGrowth = totalFollowers > 0 ? parseFloat(((newFollowers / totalFollowers) * 100).toFixed(2)) : 0;

      // Top Locations (City/Country based on followers)
      const locationsRes = await pool.query(`
        SELECT u.city, u.country, COUNT(f.follower_id) as count
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1 AND u.country IS NOT NULL
        GROUP BY u.city, u.country
        ORDER BY count DESC
        LIMIT 5
      `, [userId]);

      const topLocations = locationsRes.rows.map(r => ({
        location: r.city ? `${r.city}, ${r.country}` : r.country,
        count: parseInt(r.count, 10)
      }));

      // Gender Split
      const genderRes = await pool.query(`
        SELECT u.gender, COUNT(f.follower_id) as count
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1 AND u.gender IS NOT NULL
        GROUP BY u.gender
        ORDER BY count DESC
      `, [userId]);

      const genderSplit = genderRes.rows.map(r => ({
        gender: r.gender,
        count: parseInt(r.count, 10)
      }));

      // Age Split (calculated from birthday)
      const ageRes = await pool.query(`
        SELECT 
          CASE 
            WHEN extract(year from age(u.birthday)) < 18 THEN '<18'
            WHEN extract(year from age(u.birthday)) BETWEEN 18 AND 24 THEN '18-24'
            WHEN extract(year from age(u.birthday)) BETWEEN 25 AND 34 THEN '25-34'
            WHEN extract(year from age(u.birthday)) BETWEEN 35 AND 44 THEN '35-44'
            WHEN extract(year from age(u.birthday)) BETWEEN 45 AND 54 THEN '45-54'
            ELSE '55+' 
          END as age_group,
          COUNT(f.follower_id) as count
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1 AND u.birthday IS NOT NULL
        GROUP BY age_group
        ORDER BY count DESC
      `, [userId]);

      const ageSplit = ageRes.rows.map(r => ({
        ageGroup: r.age_group,
        count: parseInt(r.count, 10)
      }));

      // Active Times (calculated from watch_sessions on this creator's posts)
      const activeTimesRes = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM w.created_at) AS hour,
          COUNT(w.id) AS count
        FROM watch_sessions w
        JOIN posts p ON w.post_id = p.id
        WHERE p.user_id = $1 AND p.is_deleted = false
        GROUP BY EXTRACT(HOUR FROM w.created_at)
        ORDER BY count DESC
        LIMIT 5
      `, [userId]);

      const activeTimes = activeTimesRes.rows.map(r => ({
        hour: parseInt(r.hour, 10),
        count: parseInt(r.count, 10)
      }));

      return res.json({
        audience: {
          followerCount: totalFollowers,
          followerGrowth,
          topLocations,
          activeTimes,
          genderSplit,
          ageSplit
        }
      });
    } catch (error) {
      console.error('Creator Audience Error:', error);
      res.status(500).json({ error: 'Failed to fetch audience data' });
    }
  });

  return router;
};
