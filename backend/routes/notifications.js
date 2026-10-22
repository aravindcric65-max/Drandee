const express = require("express");
const authMiddleware = require("../middleware/auth");
const { normalizeMediaUrl } = require("../utils/mediaUrl");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_NOTIFICATION_REQUESTS_PER_MINUTE: 60,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_NOTIFICATION_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const formatNotification = (row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    postId: row.post_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorAvatar: normalizeMediaUrl(row.actor_avatar),
    read: row.read,
    createdAt: row.created_at,
  });

  /*
   * GET /api/notifications - Get all notifications (paginated)
   */
  router.get("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
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
          n.id,
          n.type,
          n.title,
          n.message,
          n.post_id,
          n.actor_id,
          n.actor_name,
          n.actor_avatar,
          n.read,
          n.created_at
        FROM notifications n
        WHERE n.user_id = $1
          AND (
            n.actor_id IS NULL OR (
              NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                WHERE ub.blocker_id = $1 AND ub.blocked_id = n.actor_id
              )
              AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub2
                WHERE ub2.blocker_id = n.actor_id AND ub2.blocked_id = $1
              )
              AND NOT EXISTS (
                SELECT 1 FROM user_mutes um
                WHERE um.user_id = $1 AND um.muted_id = n.actor_id
              )
            )
          )
      `;

      const params = [userId];

      if (type) {
        query += ` AND n.type = $${params.length + 1}`;
        params.push(type);
      }

      query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        notifications: result.rows.map(formatNotification),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get notifications error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/notifications/unread - Get unread count (optimized)
   */
  router.get("/unread", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const result = await pool.query(
        `SELECT COUNT(*) AS count
         FROM notifications n
         WHERE n.user_id = $1 AND n.read = FALSE
           AND (
             n.actor_id IS NULL OR (
               NOT EXISTS (
                 SELECT 1 FROM user_blocks ub
                 WHERE ub.blocker_id = $1 AND ub.blocked_id = n.actor_id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM user_blocks ub2
                 WHERE ub2.blocker_id = n.actor_id AND ub2.blocked_id = $1
               )
               AND NOT EXISTS (
                 SELECT 1 FROM user_mutes um
                 WHERE um.user_id = $1 AND um.muted_id = n.actor_id
               )
             )
           )`,
        [userId]
      );

      return res.json({
        success: true,
        unreadCount: parseInt(result.rows[0].count, 10) || 0,
      });
    } catch (err) {
      console.error("Get unread count error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/notifications/read-all - Mark all as read
   * MUST be declared before /:id/read to avoid Express matching "read-all" as an :id param
   */
  router.put("/read-all", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      const result = await pool.query(
        `UPDATE notifications
         SET read = TRUE
         WHERE user_id = $1 AND read = FALSE`,
        [userId]
      );

      return res.json({
        success: true,
        updatedCount: result.rowCount || 0,
      });
    } catch (err) {
      console.error("Mark all read error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/notifications/:id/read - Mark single as read
   */
  router.put("/:id/read", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const notificationId = parseInt(req.params.id, 10);

      if (!Number.isInteger(notificationId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification ID",
        });
      }

      const result = await pool.query(
        `UPDATE notifications
         SET read = TRUE
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Notification not found",
        });
      }

      return res.json({
        success: true,
        notificationId,
      });
    } catch (err) {
      console.error("Mark read error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * DELETE /api/notifications/:id - Delete notification
   */
  router.delete("/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const notificationId = parseInt(req.params.id, 10);

      if (!Number.isInteger(notificationId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification ID",
        });
      }

      const result = await pool.query(
        `DELETE FROM notifications
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Notification not found",
        });
      }

      return res.json({
        success: true,
        notificationId,
      });
    } catch (err) {
      console.error("Delete notification error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * DELETE /api/notifications - Delete multiple notifications
   */
  router.delete("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: "ids array required",
        });
      }

      const result = await pool.query(
        `DELETE FROM notifications
         WHERE id = ANY($1) AND user_id = $2`,
        [ids, userId]
      );

      return res.json({
        success: true,
        deletedCount: result.rowCount || 0,
      });
    } catch (err) {
      console.error("Delete multiple notifications error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/notifications/settings - Get preferences
   */
  router.get("/settings", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      const result = await pool.query(
        `SELECT
          push_enabled,
          email_enabled,
          respect_enabled,
          comment_enabled,
          follow_enabled,
          mention_enabled,
          reply_enabled,
          system_enabled
         FROM notification_preferences
         WHERE user_id = $1`,
        [userId]
      );

      const prefs = result.rows[0] || {
        push_enabled: true,
        email_enabled: true,
        respect_enabled: true,
        comment_enabled: true,
        follow_enabled: true,
        mention_enabled: true,
        reply_enabled: true,
        system_enabled: true,
      };

      return res.json({
        success: true,
        preferences: {
          push: prefs.push_enabled,
          email: prefs.email_enabled,
          respect: prefs.respect_enabled,
          comment: prefs.comment_enabled,
          follow: prefs.follow_enabled,
          mention: prefs.mention_enabled,
          reply: prefs.reply_enabled,
          system: prefs.system_enabled,
        },
      });
    } catch (err) {
      console.error("Get preferences error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/notifications/settings - Update preferences
   */
  router.put("/settings", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const {
        push,
        email,
        respect,
        comment,
        follow,
        mention,
        reply,
        system,
      } = req.body;

      await pool.query(
        `INSERT INTO notification_preferences (
          user_id,
          push_enabled,
          email_enabled,
          respect_enabled,
          comment_enabled,
          follow_enabled,
          mention_enabled,
          reply_enabled,
          system_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id)
        DO UPDATE SET
          push_enabled = EXCLUDED.push_enabled,
          email_enabled = EXCLUDED.email_enabled,
          respect_enabled = EXCLUDED.respect_enabled,
          comment_enabled = EXCLUDED.comment_enabled,
          follow_enabled = EXCLUDED.follow_enabled,
          mention_enabled = EXCLUDED.mention_enabled,
          reply_enabled = EXCLUDED.reply_enabled,
          system_enabled = EXCLUDED.system_enabled`,
        [
          userId,
          push !== false,
          email !== false,
          respect !== false,
          comment !== false,
          follow !== false,
          mention !== false,
          reply !== false,
          system !== false,
        ]
      );

      return res.json({
        success: true,
        preferences: {
          push: push !== false,
          email: email !== false,
          respect: respect !== false,
          comment: comment !== false,
          follow: follow !== false,
          mention: mention !== false,
          reply: reply !== false,
          system: system !== false,
        },
      });
    } catch (err) {
      console.error("Update preferences error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/notifications/test - Send test notification (dev only)
   */
  router.post("/test", authMiddleware, async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        error: "Not available in production",
      });
    }

    try {
      const userId = req.auth.userId;

      const result = await pool.query(
        `INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          actor_id,
          actor_name,
          read
        )
        VALUES ($1, $2, $3, $4, $1, $5, FALSE)
        RETURNING id`,
        [userId, "system", "Test Notification", "This is a test notification", "System"]
      );

      return res.json({
        success: true,
        notificationId: result.rows[0].id,
      });
    } catch (err) {
      console.error("Test notification error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * WebSocket endpoint for realtime notifications - NEW!
   */
  router.get("/stream", authMiddleware, async (req, res) => {
    // WebSocket upgrade would happen here
    // For now, return SSE endpoint info
    res.json({
      success: true,
      message: "WebSocket endpoint for realtime notifications",
      endpoint: "/ws/notifications",
    });
  });

  return router;
};