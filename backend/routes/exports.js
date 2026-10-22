const express = require("express");
const authMiddleware = require("../middleware/auth");
const crypto = require("crypto");

module.exports = (pool, redisClient) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_EXPORT_REQUESTS_PER_MINUTE: 5,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_EXPORT_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  // Generate signed download URL
  const generateSignedUrl = (exportId, userId) => {
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const signature = crypto
      .createHmac("sha256", process.env.EXPORT_SECRET || "default-secret")
      .update(`${exportId}:${userId}:${expires}`)
      .digest("hex");
    
    return `/api/exports/download/${exportId}?signature=${signature}&expires=${expires}`;
  };

  // Verify signed URL
  const verifySignedUrl = (exportId, userId, signature, expires) => {
    if (Date.now() > parseInt(expires, 10)) {
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac("sha256", process.env.EXPORT_SECRET || "default-secret")
      .update(`${exportId}:${userId}:${expires}`)
      .digest("hex");
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  };

  // Async export helper
  const processExportAsync = async (fn) => {
    setImmediate(async () => {
      try {
        await fn();
      } catch (err) {
        console.error("Async export processing error:", err.message);
      }
    });
  };

  /*
   * POST /api/exports/data - Request full data export
   */
  router.post("/data", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { format } = req.body; // json, csv, zip

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      await client.query("BEGIN");

      // Create export record
      const result = await client.query(
        `INSERT INTO data_exports (
          user_id,
          format,
          status,
          created_at
        )
        VALUES ($1, $2, 'pending', NOW())
        RETURNING id, user_id, format, status, created_at`,
        [userId, format || "json"]
      );

      await client.query("COMMIT");

      const exportId = result.rows[0].id;

      // Process async (don't block response)
      processExportAsync(async () => {
        try {
          // Gather all user data
          const [posts, comments, respects, follows, profile] = await Promise.all([
            pool.query(
              `SELECT * FROM posts WHERE user_id = $1 AND is_deleted = false ORDER BY created_at`,
              [userId]
            ),
            pool.query(
              `SELECT * FROM comments WHERE user_id = $1 ORDER BY created_at`,
              [userId]
            ),
            pool.query(
              `SELECT * FROM respects WHERE user_id = $1 ORDER BY created_at`,
              [userId]
            ),
            pool.query(
              `SELECT * FROM follows WHERE follower_id = $1 OR following_id = $1`,
              [userId]
            ),
            pool.query(
              `SELECT * FROM users WHERE id = $1`,
              [userId]
            ),
          ]);

          const exportData = {
            exportedAt: new Date().toISOString(),
            user: profile.rows[0],
            posts: posts.rows,
            comments: comments.rows,
            respects: respects.rows,
            follows: follows.rows,
          };

          // Update export status
          await pool.query(
            `UPDATE data_exports
             SET
               status = 'completed',
               data = $1,
               completed_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(exportData), exportId]
          );
        } catch (err) {
          console.error("Export generation error:", err.message);
          await pool.query(
            `UPDATE data_exports
             SET status = 'failed', error = $1
             WHERE id = $2`,
            [err.message, exportId]
          );
        }
      });

      return res.status(201).json({
        success: true,
        export: {
          id: exportId,
          format: format || "json",
          status: "pending",
          createdAt: result.rows[0].created_at,
        },
        message: "Export initiated. Check status with GET /api/exports/status/:id",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Export rollback error:", rollbackError.message);
      }
      console.error("Create export error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/exports/status/:id - Check export status
   */
  router.get("/status/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const exportId = parseInt(req.params.id, 10);

      if (!Number.isInteger(exportId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid export ID",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          user_id,
          format,
          status,
          error,
          created_at,
          completed_at
         FROM data_exports
         WHERE id = $1 AND user_id = $2`,
        [exportId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Export not found",
        });
      }

      const exportRecord = result.rows[0];

      return res.json({
        success: true,
        export: {
          id: exportRecord.id,
          format: exportRecord.format,
          status: exportRecord.status,
          error: exportRecord.error,
          createdAt: exportRecord.created_at,
          completedAt: exportRecord.completed_at,
          downloadUrl: exportRecord.status === "completed"
            ? generateSignedUrl(exportId, userId)
            : null,
        },
      });
    } catch (err) {
      console.error("Get export status error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/exports/download/:id - Download completed export
   */
  router.get("/download/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const exportId = parseInt(req.params.id, 10);
      const { signature, expires } = req.query;

      if (!Number.isInteger(exportId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid export ID",
        });
      }

      // Verify signature
      if (signature && expires) {
        if (!verifySignedUrl(exportId, userId, signature, expires)) {
          return res.status(403).json({
            success: false,
            error: "Invalid or expired download link",
          });
        }
      }

      const result = await pool.query(
        `SELECT
          id,
          user_id,
          format,
          status,
          data
         FROM data_exports
         WHERE id = $1 AND user_id = $2`,
        [exportId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Export not found",
        });
      }

      const exportRecord = result.rows[0];

      if (exportRecord.status !== "completed") {
        return res.status(400).json({
          success: false,
          error: "Export not ready yet",
        });
      }

      const filename = `export-${exportId}-${Date.now()}.${exportRecord.format}`;

      res.set("Content-Type", "application/json");
      res.set("Content-Disposition", `attachment; filename="${filename}"`);

      return res.send(exportRecord.data);
    } catch (err) {
      console.error("Download export error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/exports/posts - Export user's posts (CSV/JSON)
   */
  router.post("/posts", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { format } = req.body; // json, csv

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
          content,
          media_url,
          video_url,
          total_respects,
          comment_count,
          share_count,
          watch_count,
          created_at
         FROM posts
         WHERE user_id = $1 AND is_deleted = false
         ORDER BY created_at DESC`,
        [userId]
      );

      const posts = result.rows;

      if (format === "csv") {
        const csvHeader = "id,content,media_url,video_url,total_respects,comment_count,share_count,watch_count,created_at\n";
        const csvRows = posts.map((post) =>
          `${post.id},"${(post.content || "").replace(/"/g, '""')}",${post.media_url || ""},${post.video_url || ""},${post.total_respects},${post.comment_count},${post.share_count},${post.watch_count},${post.created_at}`
        ).join("\n");

        const csv = csvHeader + csvRows;

        res.set("Content-Type", "text/csv");
        res.set("Content-Disposition", `attachment; filename="posts-${userId}-${Date.now()}.csv"`);

        return res.send(csv);
      } else {
        const json = JSON.stringify(posts, null, 2);

        res.set("Content-Type", "application/json");
        res.set("Content-Disposition", `attachment; filename="posts-${userId}-${Date.now()}.json"`);

        return res.send(json);
      }
    } catch (err) {
      console.error("Export posts error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/exports/analytics - Export analytics data
   */
  router.post("/analytics", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { format, range } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const days = range === "90d" ? 90 : range === "7d" ? 7 : 30;

      const [posts, respects, comments, shares] = await Promise.all([
        pool.query(
          `SELECT
            DATE(created_at) AS date,
            COUNT(*) AS count,
            SUM(total_respects) AS total_respects,
            SUM(comment_count) AS total_comments,
            SUM(share_count) AS total_shares
           FROM posts
           WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [userId]
        ),
        pool.query(
          `SELECT
            DATE(created_at) AS date,
            COUNT(*) AS count
           FROM respects
           WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1 AND is_deleted = false)
           AND created_at > NOW() - INTERVAL '${days} days'
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [userId]
        ),
        pool.query(
          `SELECT
            DATE(created_at) AS date,
            COUNT(*) AS count
           FROM comments
           WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1 AND is_deleted = false)
           AND created_at > NOW() - INTERVAL '${days} days'
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [userId]
        ),
        pool.query(
          `SELECT
            DATE(created_at) AS date,
            COUNT(*) AS count
           FROM shares
           WHERE post_id IN (SELECT id FROM posts WHERE user_id = $1 AND is_deleted = false)
           AND created_at > NOW() - INTERVAL '${days} days'
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [userId]
        ),
      ]);

      const analyticsData = {
        userId,
        range: `${days}d`,
        exportedAt: new Date().toISOString(),
        posts: posts.rows,
        respects: respects.rows,
        comments: comments.rows,
        shares: shares.rows,
      };

      if (format === "csv") {
        const csv = JSON.stringify(analyticsData, null, 2);
        res.set("Content-Type", "text/csv");
        res.set("Content-Disposition", `attachment; filename="analytics-${userId}-${Date.now()}.csv"`);
        return res.send(csv);
      } else {
        const json = JSON.stringify(analyticsData, null, 2);
        res.set("Content-Type", "application/json");
        res.set("Content-Disposition", `attachment; filename="analytics-${userId}-${Date.now()}.json"`);
        return res.send(json);
      }
    } catch (err) {
      console.error("Export analytics error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/exports/followers - Export follower list
   */
  router.post("/followers", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { format, type } = req.body; // followers, following

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let query;
      if (type === "following") {
        query = `
          SELECT
            u.id,
            u.name,
            u.username,
            u.profile_pic AS avatar_url,
            u.bio,
            (SELECT COUNT(*) FROM follows f2 WHERE f2.following_id = u.id) AS follower_count,
            f.created_at
          FROM follows f
          INNER JOIN users u ON u.id = f.following_id
          WHERE f.follower_id = $1
          ORDER BY f.created_at DESC
        `;
      } else {
        query = `
          SELECT
            u.id,
            u.name,
            u.username,
            u.profile_pic AS avatar_url,
            u.bio,
            (SELECT COUNT(*) FROM follows f2 WHERE f2.following_id = u.id) AS follower_count,
            f.created_at
          FROM follows f
          INNER JOIN users u ON u.id = f.follower_id
          WHERE f.following_id = $1
          ORDER BY f.created_at DESC
        `;
      }

      const result = await pool.query(query, [userId]);

      const followersData = {
        userId,
        type: type === "following" ? "following" : "followers",
        exportedAt: new Date().toISOString(),
        count: result.rows.length,
        users: result.rows,
      };

      if (format === "csv") {
        const csvHeader = "id,name,username,avatar_url,bio,follower_count,created_at\n";
        const csvRows = result.rows.map((user) =>
          `${user.id},"${user.name}","${user.username}",${user.avatar_url || ""},"${(user.bio || "").replace(/"/g, '""')}",${user.follower_count},${user.created_at}`
        ).join("\n");

        const csv = csvHeader + csvRows;

        res.set("Content-Type", "text/csv");
        res.set("Content-Disposition", `attachment; filename="${type || "followers"}-${userId}-${Date.now()}.csv"`);

        return res.send(csv);
      } else {
        const json = JSON.stringify(followersData, null, 2);

        res.set("Content-Type", "application/json");
        res.set("Content-Disposition", `attachment; filename="${type || "followers"}-${userId}-${Date.now()}.json"`);

        return res.send(json);
      }
    } catch (err) {
      console.error("Export followers error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * DELETE /api/exports/:id - Delete old export
   */
  router.delete("/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const exportId = parseInt(req.params.id, 10);

      if (!Number.isInteger(exportId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid export ID",
        });
      }

      const result = await pool.query(
        `DELETE FROM data_exports
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [exportId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Export not found",
        });
      }

      return res.json({
        success: true,
        exportId,
      });
    } catch (err) {
      console.error("Delete export error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};