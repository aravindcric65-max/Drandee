const express = require("express");
const authMiddleware = require("../middleware/auth");

const { trackAction, getVelocity } = require("../utils/engagementVelocity");
const { sendNotification } = require("../utils/notify");
const { clearSafetyCache } = require("../utils/safetyFilter");
const { checkCooldown } = require("../utils/antiBot");
const { normalizeMediaUrl } = require("../utils/mediaUrl");

module.exports = (pool) => {
  const router = express.Router();

    const formatComment = (row) => ({
    id: row.id,
    userId: row.user_id,
    user: row.user_name,
    text: row.text,
    createdAt: row.created_at,
    respects: row.respects || 0,
    parentCommentId: row.parent_comment_id,
    isPinned: row.is_pinned || false,
  });

  const getUserVelocity = async (userId) => {
    try {
      return await getVelocity(userId);
    } catch (err) {
      console.error("Velocity read error:", err.message);
      return null;
    }
  };

  /*
   * POST /api/engagement/respect/:postId
   */
  router.post("/respect/:postId", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const postId = parseInt(req.params.postId, 10);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
if (!Number.isInteger(postId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
        });
      }

      const cooldownKey = `antibot:respect_cooldown:${userId}:${postId}`;
      const allowed = await checkCooldown(cooldownKey, 1); // 1 second
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      await client.query("BEGIN");

      const postCheck = await client.query(
        `SELECT id, user_id FROM posts WHERE id = $1 AND is_deleted = false FOR UPDATE`,
        [postId]
      );

      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      const existing = await client.query(
        `SELECT id FROM respects WHERE user_id = $1 AND post_id = $2 FOR UPDATE`,
        [userId, postId]
      );

      let respected;
      let totalRespects;

      if (existing.rows.length > 0) {
        await client.query(
          `DELETE FROM respects WHERE user_id = $1 AND post_id = $2`,
          [userId, postId]
        );

        const result = await client.query(
          `UPDATE posts
           SET total_respects = GREATEST(COALESCE(total_respects, 0) - 1, 0)
           WHERE id = $1
           RETURNING total_respects`,
          [postId]
        );

        respected = false;
        totalRespects = Number(result.rows[0].total_respects) || 0;
      } else {
        await client.query(
          `INSERT INTO respects (user_id, post_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, post_id) DO NOTHING`,
          [userId, postId]
        );

        const result = await client.query(
          `UPDATE posts
           SET total_respects = COALESCE(total_respects, 0) + 1
           WHERE id = $1
           RETURNING total_respects`,
          [postId]
        );

        respected = true;
        totalRespects = Number(result.rows[0].total_respects) || 0;
      }

      await client.query("COMMIT");

      if (respected) {
        await trackAction(userId, "respect", { postId });
        await sendNotification({
          userId: postCheck.rows[0].user_id,
          actorId: userId,
          type: 'respect',
          title: 'New Respect',
          message: 'respected your post',
          postId
        });
      }

      const velocity = await getVelocity(userId);

      return res.json({
        success: true,
        respected,
        totalRespects,
        velocity,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Respect rollback error:", rollbackError.message);
      }
      console.error("Respect toggle error:", err.message, err.stack);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/engagement/comments/:postId - With pagination - NEW!
   */
  router.get("/comments/:postId", authMiddleware, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId, 10);
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const parentCommentId = req.query.parent_comment_id || null;

      if (!Number.isInteger(postId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
        });
      }

      let query = `
        SELECT
          c.id,
          c.user_id,
          c.text,
          c.created_at,
          c.parent_comment_id,
          c.is_pinned,
          u.name AS user_name,
          (SELECT COUNT(*) FROM comment_respects cl WHERE cl.comment_id = c.id)::int AS respects
        FROM comments c
        INNER JOIN users u ON u.id = c.user_id
        WHERE c.post_id = $1
      `;

      const params = [postId];

      if (parentCommentId) {
        query += ` AND c.parent_comment_id = $${params.length + 1}`;
        params.push(parentCommentId);
      } else {
        query += ` AND c.parent_comment_id IS NULL`;
      }

      query += ` ORDER BY c.is_pinned DESC, c.created_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        comments: result.rows.map(formatComment),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get comments error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/engagement/comments/:postId
   */
  router.post("/comments/:postId", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const postId = parseInt(req.params.postId, 10);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
const text = String(req.body.text || "").trim();
      const parentCommentId = req.body.parent_comment_id || null;

      if (!Number.isInteger(postId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
        });
      }

      if (!text || text.length > 2000) {
        return res.status(400).json({
          success: false,
          error: "Comment must be 1–2000 characters",
        });
      }

      await client.query("BEGIN");

      const postCheck = await client.query(
        `SELECT id, user_id FROM posts WHERE id = $1 AND is_deleted = false`,
        [postId]
      );

      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      const inserted = await client.query(
        `INSERT INTO comments (user_id, post_id, text, parent_comment_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, text, created_at, parent_comment_id`,
        [userId, postId, text, parentCommentId]
      );

      const countResult = await client.query(
        `UPDATE posts
         SET comment_count = COALESCE(comment_count, 0) + 1
         WHERE id = $1
         RETURNING comment_count`,
        [postId]
      );

      const userResult = await client.query(
        `SELECT name FROM users WHERE id = $1`,
        [userId]
      );

      await client.query("COMMIT");

      await trackAction(userId, "comment", { postId });
      await sendNotification({
        userId: postCheck.rows[0].user_id,
        actorId: userId,
        type: 'comment',
        title: 'New Comment',
        message: text,
        postId
      });

      const comment = formatComment({
        ...inserted.rows[0],
        user_name: userResult.rows[0]?.name || "User",
        respects: 0,
      });

      const velocity = await getVelocity(userId);

      return res.status(201).json({
        success: true,
        comment,
        commentCount: countResult.rows[0].comment_count,
        velocity,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Comment rollback error:", rollbackError.message);
      }
      console.error(`[COMMENT-ERROR] Add comment error for postId=${req.params.postId}, userId=${req.auth?.userId}:`, {message: err.message, code: err.code, detail: err.detail, constraint: err.constraint, table: err.table, column: err.column, stack: err.stack});
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * PUT /api/engagement/comments/:id/pin - NEW!
   */
  router.put("/comments/:id/pin", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
      const commentId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
if (!Number.isInteger(commentId)) {
        return res.status(400).json({ success: false, error: "Invalid comment ID" });
      }

      await client.query("BEGIN");

      // Check comment and post ownership
      const commentCheck = await client.query(
        `SELECT c.id, c.post_id, c.is_pinned, p.user_id as post_owner_id 
         FROM comments c 
         INNER JOIN posts p ON c.post_id = p.id 
         WHERE c.id = $1 FOR UPDATE`,
        [commentId]
      );

      if (commentCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, error: "Comment not found" });
      }

      const { post_id, is_pinned, post_owner_id } = commentCheck.rows[0];

      if (String(post_owner_id) !== String(userId)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ success: false, error: "Only post owner can pin comments" });
      }

      const willPin = !is_pinned;

      if (willPin) {
        // Enforce max 2 pinned comments
        const countCheck = await client.query(
          `SELECT COUNT(*) as count FROM comments WHERE post_id = $1 AND is_pinned = true`,
          [post_id]
        );
        
        if (parseInt(countCheck.rows[0].count, 10) >= 2) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, error: "Maximum of 2 pinned comments allowed per post" });
        }
      }

      await client.query(
        `UPDATE comments SET is_pinned = $1 WHERE id = $2`,
        [willPin, commentId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        isPinned: willPin,
        message: willPin ? "Comment pinned" : "Comment unpinned"
      });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch (rollbackError) {}
      console.error("Pin comment error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /*
   * PUT /api/engagement/comments/:id - NEW!
   */
  router.put("/comments/:id", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const commentId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
const text = String(req.body.text || "").trim();

      if (!Number.isInteger(commentId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid comment ID",
        });
      }

      if (!text || text.length > 2000) {
        return res.status(400).json({
          success: false,
          error: "Comment must be 1–2000 characters",
        });
      }

      await client.query("BEGIN");

      // Check ownership
      const ownerCheck = await client.query(
        `SELECT user_id FROM comments WHERE id = $1`,
        [commentId]
      );

      if (ownerCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Comment not found",
        });
      }

      if (String(ownerCheck.rows[0].user_id) !== String(userId)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          error: "Not your comment",
        });
      }

      const updated = await client.query(
        `UPDATE comments
         SET text = $1, edited_at = NOW()
         WHERE id = $2
         RETURNING id, user_id, text, created_at, edited_at`,
        [text, commentId]
      );

      await client.query("COMMIT");

      const userResult = await client.query(
        `SELECT name FROM users WHERE id = $1`,
        [userId]
      );

      const comment = formatComment({
        ...updated.rows[0],
        user_name: userResult.rows[0]?.name || "User",
      });

      return res.json({
        success: true,
        comment,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Comment edit rollback error:", rollbackError.message);
      }
      console.error("Comment edit error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * DELETE /api/engagement/comments/:id - NEW!
   */
  router.delete("/comments/:id", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const commentId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
if (!Number.isInteger(commentId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid comment ID",
        });
      }

      await client.query("BEGIN");

      // Check ownership
      const ownerCheck = await client.query(
        `SELECT user_id, post_id FROM comments WHERE id = $1`,
        [commentId]
      );

      if (ownerCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Comment not found",
        });
      }

      if (String(ownerCheck.rows[0].user_id) !== String(userId)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          error: "Not your comment",
        });
      }

      await client.query(`DELETE FROM comments WHERE id = $1`, [commentId]);

      const countResult = await client.query(
        `UPDATE posts
         SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
         WHERE id = $1
         RETURNING comment_count`,
        [ownerCheck.rows[0].post_id]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        commentCount: countResult.rows[0].comment_count,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Comment delete rollback error:", rollbackError.message);
      }
      console.error("Comment delete error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/engagement/comments/:id/respect - NEW!
   */
  router.post("/comments/:id/respect", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const commentId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
if (!Number.isInteger(commentId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid comment ID",
        });
      }

      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id FROM comment_respects WHERE user_id = $1 AND comment_id = $2`,
        [userId, commentId]
      );

      let respected;
      let totalRespects;

      if (existing.rows.length > 0) {
        await client.query(
          `DELETE FROM comment_respects WHERE user_id = $1 AND comment_id = $2`,
          [userId, commentId]
        );

        const result = await client.query(
          `SELECT COUNT(*)::int AS respect_count FROM comment_respects WHERE comment_id = $1`,
          [commentId]
        );

        respected = false;
        totalRespects = Number(result.rows[0].respect_count) || 0;
      } else {
        await client.query(
          `INSERT INTO comment_respects (user_id, comment_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, comment_id) DO NOTHING`,
          [userId, commentId]
        );

        const result = await client.query(
          `SELECT COUNT(*)::int AS respect_count FROM comment_respects WHERE comment_id = $1`,
          [commentId]
        );

        respected = true;
        totalRespects = Number(result.rows[0].respect_count) || 0;
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        respected,
        totalRespects,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Comment respect rollback error:", rollbackError.message);
      }
      console.error("Comment respect error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/engagement/share/:postId
   */
  router.post("/share/:postId", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const postId = parseInt(req.params.postId, 10);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
const platform = String(req.body.platform || "copy").trim().slice(0, 50);

      if (!Number.isInteger(postId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
        });
      }

      await client.query("BEGIN");

      const postCheck = await client.query(
        `SELECT id FROM posts WHERE id = $1 AND is_deleted = false`,
        [postId]
      );

      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      // Deduplication - NEW!
      await client.query(
        `INSERT INTO shares (user_id, post_id, platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, post_id, platform) DO NOTHING`,
        [userId, postId, platform]
      );

      const countResult = await client.query(
        `UPDATE posts
         SET share_count = COALESCE(share_count, 0) + 1
         WHERE id = $1
         RETURNING share_count`,
        [postId]
      );

      await client.query("COMMIT");

      await trackAction(userId, "share", { postId });

      const velocity = await getVelocity(userId);

      return res.json({
        success: true,
        shareCount: countResult.rows[0].share_count,
        velocity,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Share rollback error:", rollbackError.message);
      }
      console.error("Share error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /* ────────────────────────────────────────────────────────
   * GET /api/engagement/stats/:postId
   * Returns: { views, totalRespects, comments, shares, lastUpdated }
   * ────────────────────────────────────────────────────────*/
  router.get("/stats/:postId", authMiddleware, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId, 10);
      if (!Number.isInteger(postId)) return res.status(400).json({ success: false, error: "Invalid post ID" });

      const result = await pool.query(
        `SELECT
           COALESCE(watch_count, 0)     AS views,
           COALESCE(total_respects, 0) AS total_respects,
           COALESCE(comment_count, 0)  AS comments,
           COALESCE(share_count, 0)    AS shares,
           updated_at                  AS last_updated
         FROM posts WHERE id = $1 AND is_deleted = false`,
        [postId]
      );

      if (result.rows.length === 0) return res.status(404).json({ success: false, error: "Post not found" });
      const r = result.rows[0];
      return res.json({
        success: true,
        views: Number(r.views),
        totalRespects: Number(r.total_respects),
        comments: Number(r.comments),
        shares: Number(r.shares),
        lastUpdated: r.last_updated,
      });
    } catch (err) {
      console.error("Engagement stats error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /* ────────────────────────────────────────────────────────
   * GET /api/engagement/audio/:audioId/reels
   * Returns reels using a given audio name/id (3-column grid data)
   * ────────────────────────────────────────────────────────*/
  router.get("/audio/:audioId/reels", authMiddleware, async (req, res) => {
    try {
      const { audioId } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 18, 50);

      // audioId can be an audio name string or numeric id
      const isNumeric = /^\d+$/.test(audioId);
      const query = isNumeric
        ? `SELECT id, title, thumbnail_url, video_url,
                  COALESCE(watch_count,0)     AS views,
                  COALESCE(total_respects,0)  AS respects
           FROM posts WHERE audio_id = $1 AND is_deleted = false
           ORDER BY created_at DESC LIMIT $2`
        : `SELECT id, title, thumbnail_url, video_url,
                  COALESCE(watch_count,0)     AS views,
                  COALESCE(total_respects,0)  AS respects
           FROM posts WHERE audio_name ILIKE $1 AND is_deleted = false
           ORDER BY created_at DESC LIMIT $2`;

      const param = isNumeric ? parseInt(audioId, 10) : `%${audioId}%`;
      const result = await pool.query(query, [param, limit]);

      return res.json({
        success: true,
        reels: result.rows.map(r => ({
          id: r.id,
          title: r.title,
          thumbnail: r.thumbnail_url,
          videoUrl: r.video_url,
          views: Number(r.views),
          respects: Number(r.respects),
        })),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("Audio reels error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /* ────────────────────────────────────────────────────────
   * POST /api/engagement/block/:creatorId
   * Block/unblock a creator — hides all their future reels
   * ────────────────────────────────────────────────────────*/
  router.post("/block/:creatorId", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
      const blockerId = req.auth.userId;
      const blockedId = parseInt(req.params.creatorId, 10);
      if (!Number.isInteger(blockedId)) return res.status(400).json({ success: false, error: "Invalid creator ID" });
      if (blockerId === blockedId) return res.status(400).json({ success: false, error: "Cannot block yourself" });

      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
        [blockerId, blockedId]
      );

      let blocked;
      if (existing.rows.length > 0) {
        await client.query(`DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2`, [blockerId, blockedId]);
        blocked = false;
      } else {
        await client.query(
          `INSERT INTO user_blocks (blocker_id, blocked_id, created_at) VALUES ($1,$2,NOW())
           ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
          [blockerId, blockedId]
        );
        // also unfollow both ways
        await client.query(
          `DELETE FROM follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)`,
          [blockerId, blockedId]
        );
        blocked = true;
      }

      await client.query("COMMIT");
      // Invalidate safety cache immediately to prevent blocked content in feeds
      clearSafetyCache(blockerId);
      return res.json({ success: true, blocked });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch (_) {}
      console.error("Block error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /* ────────────────────────────────────────────────────────
   * GET /api/engagement/block-list
   * List blocked creators for the authenticated user
   * ────────────────────────────────────────────────────────*/
  router.get("/block-list", authMiddleware, async (req, res) => {
    try {
      const blockerId = req.auth.userId;
      if (!blockerId) return res.status(401).json({ success: false, error: "Authentication required" });

      const result = await pool.query(
        `SELECT u.id, u.username, u.name, u.profile_pic, b.created_at
         FROM user_blocks b
         JOIN users u ON b.blocked_id = u.id
         WHERE b.blocker_id = $1
         ORDER BY b.created_at DESC`,
        [blockerId]
      );

      const blocks = result.rows.map((r) => ({ ...r, profile_pic: normalizeMediaUrl(r.profile_pic) }));
      return res.json({ success: true, blocks });
    } catch (err) {
      console.error("Get block list error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /* ────────────────────────────────────────────────────────
   * POST /api/engagement/mute/:creatorId
   * Mute / unmute a creator
   * ────────────────────────────────────────────────────────*/
  router.post("/mute/:creatorId", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
      const mutedId = parseInt(req.params.creatorId, 10);
      if (!Number.isInteger(mutedId)) return res.status(400).json({ success: false, error: "Invalid creator ID" });
      if (userId === mutedId) return res.status(400).json({ success: false, error: "Cannot mute yourself" });

      const existing = await pool.query(
        `SELECT id FROM user_mutes WHERE user_id = $1 AND muted_id = $2`,
        [userId, mutedId]
      );

      let muted;
      if (existing.rows.length > 0) {
        await pool.query(`DELETE FROM user_mutes WHERE user_id = $1 AND muted_id = $2`, [userId, mutedId]);
        muted = false;
      } else {
        await pool.query(
          `INSERT INTO user_mutes (user_id, muted_id, created_at) VALUES ($1, $2, NOW())
           ON CONFLICT (user_id, muted_id) DO NOTHING`,
          [userId, mutedId]
        );
        muted = true;
      }

      if (typeof clearSafetyCache === "function") {
        clearSafetyCache(userId);
      }

      return res.json({ success: true, muted });
    } catch (err) {
      console.error("Mute error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /* ────────────────────────────────────────────────────────
   * GET /api/engagement/mute-list
   * List muted creators for the authenticated user
   * ────────────────────────────────────────────────────────*/
  router.get("/mute-list", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

      const result = await pool.query(
        `SELECT u.id, u.username, u.name, u.profile_pic, m.created_at
         FROM user_mutes m
         JOIN users u ON m.muted_id = u.id
         WHERE m.user_id = $1
         ORDER BY m.created_at DESC`,
        [userId]
      );

      const mutes = result.rows.map((r) => ({ ...r, profile_pic: normalizeMediaUrl(r.profile_pic) }));
      return res.json({ success: true, mutes });
    } catch (err) {
      console.error("Get mute list error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /* ────────────────────────────────────────────────────────
   * POST /api/engagement/not-interested/:postId
   * Mark a reel as not interested
   * ────────────────────────────────────────────────────────*/
  router.post("/not-interested/:postId", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
const postId = parseInt(req.params.postId, 10);
      if (!Number.isInteger(postId)) return res.status(400).json({ success: false, error: "Invalid post ID" });

      await pool.query(
        `INSERT INTO not_interested_posts (user_id, post_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, post_id) DO NOTHING`,
        [userId, postId]
      );

      return res.json({ success: true, message: "Marked as not interested" });
    } catch (err) {
      console.error("Not interested error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /* ────────────────────────────────────────────────────────
   * POST /api/engagement/content-preferences
   * Update content type preferences (hide genre/category)
   * Body: { category: string, action: 'hide'|'show' }
   * ────────────────────────────────────────────────────────*/
  router.post("/content-preferences", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
const { category, action = "hide" } = req.body;
      if (!category) return res.status(400).json({ success: false, error: "category is required" });

      if (action === "hide") {
        await pool.query(
          `INSERT INTO user_content_preferences (user_id, hidden_category, created_at)
           VALUES ($1, $2, NOW()) ON CONFLICT (user_id, hidden_category) DO NOTHING`,
          [userId, category]
        );
      } else {
        await pool.query(
          `DELETE FROM user_content_preferences WHERE user_id=$1 AND hidden_category=$2`,
          [userId, category]
        );
      }

      return res.json({ success: true, category, action });
    } catch (err) {
      console.error("Content preferences error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /* ────────────────────────────────────────────────────────
   * POST /api/engagement/save/:postId
   * Save / unsave a reel. Body: { collectionName? }
   * ────────────────────────────────────────────────────────*/
  router.post("/save/:postId", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
const postId = parseInt(req.params.postId, 10);
      const collectionName = (req.body && req.body.collectionName) ? req.body.collectionName : "Saved";
      if (!Number.isInteger(postId)) return res.status(400).json({ success: false, error: "Invalid post ID" });

      await client.query("BEGIN");

      // Use saved_posts (has user_id, post_id, collection_name)
      const existing = await client.query(
        `SELECT id FROM saved_posts WHERE user_id=$1 AND post_id=$2`,
        [userId, postId]
      );

      let saved;
      if (existing.rows.length > 0) {
        await client.query(`DELETE FROM saved_posts WHERE user_id=$1 AND post_id=$2`, [userId, postId]);
        await client.query(
          `UPDATE posts SET save_count = GREATEST(COALESCE(save_count,0)-1,0) WHERE id=$1`,
          [postId]
        );
        saved = false;
      } else {
        await client.query(
          `INSERT INTO saved_posts (user_id, post_id, collection_name, created_at)
           VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id, post_id) DO NOTHING`,
          [userId, postId, collectionName]
        );
        await client.query(
          `UPDATE posts SET save_count = COALESCE(save_count,0)+1 WHERE id=$1`,
          [postId]
        );
        saved = true;
      }

      await client.query("COMMIT");
      return res.json({ success: true, saved, collectionName });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch (_) {}
      console.error("Save post error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /* ────────────────────────────────────────────────────────
   * GET /api/engagement/badge/:userId
   * Returns user badge level and rank info
   * ────────────────────────────────────────────────────────*/
  router.get("/badge/:userId", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (!Number.isInteger(userId)) return res.status(400).json({ success: false, error: "Invalid user ID" });

      const result = await pool.query(
        `SELECT
           u.id, u.name, u.username, u.current_badge,
           COALESCE(SUM(p.total_respects), 0) AS total_respects
         FROM users u
         LEFT JOIN posts p ON COALESCE(p.user_id, p.creator_id) = u.id AND p.is_deleted = false
         WHERE u.id = $1
         GROUP BY u.id, u.name, u.username, u.current_badge`,
        [userId]
      );

      if (result.rows.length === 0) return res.status(404).json({ success: false, error: "User not found" });

      const r = result.rows[0];
      return res.json({
        success: true,
        userId: r.id,
        username: r.username,
        badge: r.current_badge,
        totalRespects: Number(r.total_respects),
      });
    } catch (err) {
      console.error("Badge error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  router.get("/viewers/:postId", authMiddleware, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId, 10);
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
if (!Number.isInteger(postId)) return res.status(400).json({ success: false, error: "Invalid post ID" });

      const ownershipCheck = await pool.query(
        `SELECT id FROM posts WHERE id = $1 AND (user_id = $2 OR creator_id = $2) LIMIT 1`,
        [postId, userId]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const result = await pool.query(
        `SELECT DISTINCT ON (u.id) 
           u.id, u.name as "displayName", u.username, u.profile_pic as "avatarUrl",
           EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as "isFollowing",
           (SELECT COALESCE(SUM(total_respects), 0) FROM posts WHERE user_id = u.id AND is_deleted = false) as "totalRespects"
         FROM feed_impressions f
         JOIN users u ON f.user_id = u.id
         WHERE f.post_id = $2
         ORDER BY u.id, f.seen_at DESC
         LIMIT $3`,
        [userId, postId, limit]
      );

      return res.json({
        success: true,
        data: {
          viewers: result.rows
        }
      });
    } catch (err) {
      console.error("Viewers error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  return router;
};