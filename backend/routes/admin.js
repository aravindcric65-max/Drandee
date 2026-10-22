const requireRole = require("../middleware/role");
const express = require("express");
const authMiddleware = require("../middleware/auth");
const { formatPost } = require("../models/postModel");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_ADMIN_REQUESTS_PER_MINUTE: 100,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_ADMIN_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const isAdmin = (req) => {
    return req.auth.role === "admin" || req.user?.is_admin === true;
  };

  const logAdminAction = async (dbClient, adminId, action, targetType, targetId, details) => {
    try {
      await dbClient.query(
        `INSERT INTO admin_audit_logs (
          admin_id,
          action,
          target_type,
          target_id,
          details,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())`,
        [adminId, action, targetType, targetId, details]
      );
    } catch (err) {
      console.error("Audit log error:", err.message);
    }
  };

  const formatUser = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    avatar: row.avatar_url,
    bio: row.bio,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    postCount: row.post_count,
    isBanned: row.account_status === 'SUSPENDED',
    isVerified: row.is_verified,
    createdAt: row.created_at,
  });

  /*
   * GET /api/admin/dashboard - Platform stats & overview
   */
  router.get("/dashboard", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    try {
      const userId = req.auth.userId;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const [
        totalUsers,
        totalPosts,
        totalReports,
        pendingReports,
        bannedUsers,
        totalRespects,
      ] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS count FROM users`),
        pool.query(`SELECT COUNT(*) AS count FROM posts WHERE is_deleted = false`),
        pool.query(`SELECT COUNT(*) AS count FROM reports`),
        pool.query(`SELECT COUNT(*) AS count FROM reports WHERE status = 'pending'`),
        pool.query(`SELECT COUNT(*) AS count FROM users WHERE account_status = 'SUSPENDED'`),
        pool.query(`SELECT COALESCE(SUM(total_respects), 0) AS total FROM posts WHERE is_deleted = false`),
      ]);

      return res.json({
        success: true,
        dashboard: {
          totalUsers: parseInt(totalUsers.rows[0].count, 10),
          totalPosts: parseInt(totalPosts.rows[0].count, 10),
          totalReports: parseInt(totalReports.rows[0].count, 10),
          pendingReports: parseInt(pendingReports.rows[0].count, 10),
          bannedUsers: parseInt(bannedUsers.rows[0].count, 10),
          totalRespects: parseInt(totalRespects.rows[0].total, 10),
        },
      });
    } catch (err) {
      console.error("Admin dashboard error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/admin/users - List all users (with filters)
   */
  router.get("/users", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = parseInt(req.query.offset) || 0;
      const search = req.query.search || null;
      const isBanned = req.query.is_banned || null;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let query = `
        SELECT
          id,
          name,
          username,
          email,
          profile_pic AS avatar_url,
          bio,
          (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS follower_count,
          (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
          (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.is_deleted = false) AS post_count,
          (account_status = 'SUSPENDED') AS is_banned,
          is_verified,
          created_at
        FROM users u
        WHERE 1=1
      `;

      const params = [];

      if (search) {
        query += ` AND (name ILIKE $${params.length + 1} OR username ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      if (isBanned !== null) {
        query += ` AND account_status = 'SUSPENDED' = $${params.length + 1}`;
        params.push(isBanned === "true");
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        users: result.rows.map(formatUser),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Admin users error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/admin/users/:id - Get user details
   */
  router.get("/users/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    try {
      const userId = req.auth.userId;
      const targetUserId = parseInt(req.params.id, 10);

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!Number.isInteger(targetUserId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          name,
          username,
          email,
          profile_pic AS avatar_url,
          bio,
          (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS follower_count,
          (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
          (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.is_deleted = false) AS post_count,
          (account_status = 'SUSPENDED') AS is_banned,
          is_verified,
          banned_at,
          created_at
         FROM users u
         WHERE id = $1`,
        [targetUserId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      return res.json({
        success: true,
        user: formatUser(result.rows[0]),
      });
    } catch (err) {
      console.error("Admin user details error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/admin/users/:id/ban - Ban a user
   */
  router.put("/users/:id/ban", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    const client = await pool.connect();

    try {
      const adminId = req.auth.userId;
      const targetUserId = parseInt(req.params.id, 10);
      const { reason, duration } = req.body;

      // Rate limit check
      if (!checkRateLimit(adminId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!Number.isInteger(targetUserId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID",
        });
      }

      await client.query("BEGIN");

      const userCheck = await client.query(
        `SELECT id, account_status FROM users WHERE id = $1`,
        [targetUserId]
      );

      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      if (userCheck.rows[0].account_status === 'SUSPENDED') {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "User is already banned",
        });
      }

      await client.query(
        `UPDATE users
         SET
           account_status = 'SUSPENDED',
           banned_at = NOW(),
           ban_reason = $1,
           ban_duration = $2
         WHERE id = $3`,
        [reason || null, duration || null, targetUserId]
      );

      await logAdminAction(client, adminId, "ban_user", "user", targetUserId, { reason, duration });

      await client.query("COMMIT");

      return res.json({
        success: true,
        userId: targetUserId,
        banned: true,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Ban rollback error:", rollbackError.message);
      }
      console.error("Ban user error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * PUT /api/admin/users/:id/unban - Unban a user
   */
  router.put("/users/:id/unban", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    const client = await pool.connect();

    try {
      const adminId = req.auth.userId;
      const targetUserId = parseInt(req.params.id, 10);

      // Rate limit check
      if (!checkRateLimit(adminId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!Number.isInteger(targetUserId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID",
        });
      }

      await client.query("BEGIN");

      const userCheck = await client.query(
        `SELECT id, account_status FROM users WHERE id = $1`,
        [targetUserId]
      );

      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      if (userCheck.rows[0].account_status !== 'SUSPENDED') {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "User is not banned",
        });
      }

      await client.query(
        `UPDATE users
         SET
           account_status = 'ACTIVE',
           banned_at = NULL,
           ban_reason = NULL,
           ban_duration = NULL
         WHERE id = $1`,
        [targetUserId]
      );

      await logAdminAction(client, adminId, "unban_user", "user", targetUserId);

      await client.query("COMMIT");

      return res.json({
        success: true,
        userId: targetUserId,
        banned: false,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Unban rollback error:", rollbackError.message);
      }
      console.error("Unban user error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * DELETE /api/admin/users/:id - Delete a user
   */
  router.delete("/users/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    const client = await pool.connect();

    try {
      const adminId = req.auth.userId;
      const targetUserId = parseInt(req.params.id, 10);

      // Rate limit check
      if (!checkRateLimit(adminId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!Number.isInteger(targetUserId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID",
        });
      }

      await client.query("BEGIN");

      const userCheck = await client.query(
        `SELECT id FROM users WHERE id = $1`,
        [targetUserId]
      );

      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Soft delete - mark as deleted
      await client.query(
        `UPDATE users
         SET
           is_deleted = TRUE,
           deleted_at = NOW()
         WHERE id = $1`,
        [targetUserId]
      );

      await logAdminAction(client, adminId, "delete_user", "user", targetUserId);

      await client.query("COMMIT");

      return res.json({
        success: true,
        userId: targetUserId,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Delete user rollback error:", rollbackError.message);
      }
      console.error("Delete user error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/admin/posts - List all posts (with filters)
   */
  router.get("/posts", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = parseInt(req.query.offset) || 0;
      const search = req.query.search || null;
      const isDeleted = req.query.is_deleted || null;

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
          p.content,
          p.media_url,
          p.video_url,
          p.total_respects,
          p.comment_count,
          p.share_count,
          p.is_deleted,
          p.created_at
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        WHERE 1=1
      `;

      const params = [];

      if (search) {
        query += ` AND p.content ILIKE $${params.length + 1}`;
        params.push(`%${search}%`);
      }

      if (isDeleted !== null) {
        query += ` AND p.is_deleted = $${params.length + 1}`;
        params.push(isDeleted === "true");
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
      });
    } catch (err) {
      console.error("Admin posts error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * DELETE /api/admin/posts/:id - Delete a post
   */
  router.delete("/posts/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    const client = await pool.connect();

    try {
      const adminId = req.auth.userId;
      const postId = parseInt(req.params.id, 10);
      const { reason } = req.body;

      // Rate limit check
      if (!checkRateLimit(adminId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!Number.isInteger(postId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
        });
      }

      await client.query("BEGIN");

      const postCheck = await client.query(
        `SELECT id, user_id FROM posts WHERE id = $1`,
        [postId]
      );

      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      await client.query(
        `UPDATE posts
         SET
           is_deleted = TRUE,
           deleted_at = NOW(),
           deletion_reason = $1
         WHERE id = $2`,
        [reason || null, postId]
      );

      await logAdminAction(client, adminId, "delete_post", "post", postId, { reason });

      await client.query("COMMIT");

      return res.json({
        success: true,
        postId,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Delete post rollback error:", rollbackError.message);
      }
      console.error("Delete post error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/admin/reports - View all reports
   */
  router.get("/reports", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status || "pending";
      const type = req.query.type || null;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let query = `
        SELECT
          r.id,
          r.type,
          r.target_type,
          r.target_id,
          r.reason,
          r.category,
          r.description,
          r.status,
          r.reporter_id,
          ru.name AS reporter_name,
          r.created_at,
          r.resolved_at,
          r.resolved_by,
          r.action
        FROM reports r
        LEFT JOIN users ru ON ru.id = r.reporter_id
        WHERE r.status = $1
      `;

      const params = [status];

      if (type) {
        query += ` AND r.target_type = $${params.length + 1}`;
        params.push(type);
      }

      query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        reports: result.rows.map((row) => ({
          id: row.id,
          type: row.type,
          targetType: row.target_type,
          targetId: row.target_id,
          reason: row.reason,
          category: row.category,
          description: row.description,
          status: row.status,
          reporterId: row.reporter_id,
          reporterName: row.reporter_name,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
          resolvedBy: row.resolved_by,
          action: row.action,
        })),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Admin reports error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/admin/settings - Get platform settings
   */
  router.get("/settings", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    try {
      const userId = req.auth.userId;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT * FROM platform_settings LIMIT 1`
      );

      const settings = result.rows[0] || {
        maintenance_mode: false,
        signup_enabled: true,
        post_enabled: true,
        comment_enabled: true,
        max_post_length: 2000,
        max_video_duration: 300,
      };

      return res.json({
        success: true,
        settings,
      });
    } catch (err) {
      console.error("Admin settings error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/admin/settings - Update platform settings
   */
  router.put("/settings", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    const client = await pool.connect();

    try {
      const adminId = req.auth.userId;
      const {
        maintenanceMode,
        signupEnabled,
        postEnabled,
        commentEnabled,
        maxPostLength,
        maxVideoDuration,
      } = req.body;

      // Rate limit check
      if (!checkRateLimit(adminId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO platform_settings (
          id,
          maintenance_mode,
          signup_enabled,
          post_enabled,
          comment_enabled,
          max_post_length,
          max_video_duration,
          updated_at
        )
        VALUES (
          1,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          maintenance_mode = EXCLUDED.maintenance_mode,
          signup_enabled = EXCLUDED.signup_enabled,
          post_enabled = EXCLUDED.post_enabled,
          comment_enabled = EXCLUDED.comment_enabled,
          max_post_length = EXCLUDED.max_post_length,
          max_video_duration = EXCLUDED.max_video_duration,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          maintenanceMode !== false,
          signupEnabled !== false,
          postEnabled !== false,
          commentEnabled !== false,
          maxPostLength || 2000,
          maxVideoDuration || 300,
        ]
      );

      await logAdminAction(client, adminId, "update_settings", "system", 1, req.body);

      await client.query("COMMIT");

      return res.json({
        success: true,
        settings: result.rows[0],
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Settings rollback error:", rollbackError.message);
      }
      console.error("Update settings error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/admin/audit-logs - View admin action logs
   */
  router.get("/audit-logs", authMiddleware, requireRole('ADMIN'), async (req, res) => {
    

    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = parseInt(req.query.offset) || 0;
      const adminId = req.query.admin_id || null;
      const action = req.query.action || null;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let query = `
        SELECT
          id,
          admin_id,
          action,
          target_type,
          target_id,
          details,
          created_at
        FROM admin_audit_logs
        WHERE 1=1
      `;

      const params = [];

      if (adminId) {
        query += ` AND admin_id = $${params.length + 1}`;
        params.push(adminId);
      }

      if (action) {
        query += ` AND action = $${params.length + 1}`;
        params.push(action);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        auditLogs: result.rows.map((row) => ({
          id: row.id,
          adminId: row.admin_id,
          action: row.action,
          targetType: row.target_type,
          targetId: row.target_id,
          details: row.details,
          createdAt: row.created_at,
        })),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Admin audit logs error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};