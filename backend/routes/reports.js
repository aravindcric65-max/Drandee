const express = require("express");
const authMiddleware = require("../middleware/auth");
const requireRole = require("../middleware/role");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting map
  const rateLimits = {
    MAX_REPORT_REQUESTS_PER_MINUTE: 10,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_REPORT_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  /*
   * POST /api/reports/post/:postId - Report a post
   */
  router.post("/post/:postId", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
      const reporterId = req.auth.userId;
      const postId = req.params.postId;
      const { reason, category, description } = req.body;

      if (!checkRateLimit(reporterId)) {
        return res.status(429).json({ success: false, error: "Too many reports. Please slow down." });
      }
      if (!reason) {
        return res.status(400).json({ success: false, error: "reason required" });
      }

      await client.query("BEGIN");

      // Verify post exists
      const postCheck = await client.query("SELECT id FROM posts WHERE id = $1", [postId]);
      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      // Check for duplicate in post_reports
      const existing = await client.query(
        "SELECT id FROM post_reports WHERE reporter_id = $1 AND post_id = $2",
        [reporterId, postId]
      );

      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ success: false, error: "Report already submitted" });
      }

      const result = await client.query(
        "INSERT INTO post_reports (reporter_id, post_id, created_at, reason, category, description) VALUES ($1, $2, NOW(), $3, $4, $5) RETURNING id, created_at",
        [reporterId, postId, reason, category || reason, description || null]
      );

      await client.query("COMMIT");
      return res.status(201).json({
        success: true,
        report: {
          id: result.rows[0].id,
          type: "post",
          targetId: postId,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      // Handle Postgres unique constraint violation explicitly (code 23505)
      if (err.code === '23505') {
        return res.status(409).json({ success: false, error: "Report already submitted" });
      }
      console.error("Report post error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/reports/user/:userId - Report a user
   */
  router.post("/user/:userId", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
      const reporterId = req.auth.userId;
      const targetUserId = req.params.userId;

      if (!checkRateLimit(reporterId)) {
        return res.status(429).json({ success: false, error: "Too many reports. Please slow down." });
      }
      if (targetUserId === reporterId) {
        return res.status(400).json({ success: false, error: "Cannot report yourself" });
      }

      await client.query("BEGIN");

      // Verify user exists
      const userCheck = await client.query("SELECT id FROM users WHERE id = $1", [targetUserId]);
      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Check for duplicate in user_reports (Note: the column is erroneously named post_id in schema)
      const existing = await client.query(
        "SELECT * FROM user_reports WHERE reporter_id = $1 AND post_id = $2",
        [reporterId, targetUserId]
      );

      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ success: false, error: "Report already submitted" });
      }

      await client.query(
        "INSERT INTO user_reports (reporter_id, post_id) VALUES ($1, $2)",
        [reporterId, targetUserId]
      );

      await client.query("COMMIT");
      return res.status(201).json({
        success: true,
        report: {
          type: "user",
          targetId: targetUserId
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === '23505') {
        return res.status(409).json({ success: false, error: "Report already submitted" });
      }
      console.error("Report user error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/reports/reel/:reelId - Report a reel
   */
  router.post("/reel/:reelId", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
      const reporterId = req.auth.userId;
      const reelId = req.params.reelId;
      const { reason, category, description } = req.body;

      if (!checkRateLimit(reporterId)) {
        return res.status(429).json({ success: false, error: "Too many reports. Please slow down." });
      }

      await client.query("BEGIN");

      // Verify reel exists
      const reelCheck = await client.query("SELECT id FROM reels WHERE id = $1", [reelId]);
      if (reelCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, error: "Reel not found" });
      }

      // Check for duplicate in reports
      const existing = await client.query(
        "SELECT id FROM reports WHERE reporter_id = $1 AND reel_id = $2 AND status = 'pending'",
        [reporterId, reelId]
      );

      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ success: false, error: "Report already submitted" });
      }

      const result = await client.query(
        "INSERT INTO reports (reporter_id, reel_id, reason, category, description, status, timestamp) VALUES ($1, $2, $3, $4, $5, 'pending', NOW()) RETURNING id, timestamp",
        [reporterId, reelId, reason, category, description || null]
      );

      await client.query("COMMIT");
      return res.status(201).json({
        success: true,
        report: {
          id: result.rows[0].id,
          type: "reel",
          targetId: reelId,
          status: "pending",
          timestamp: result.rows[0].timestamp,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === '23505') {
        return res.status(409).json({ success: false, error: "Report already submitted" });
      }
      console.error("Report reel error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  return router;
};