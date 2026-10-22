const express = require("express");
const authMiddleware = require("../middleware/auth");
const { formatPost } = require("../models/postModel");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting
  const rateLimits = {
    MAX_BOOKMARK_REQUESTS_PER_MINUTE: 60,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    if (recentReqs.length >= rateLimits.MAX_BOOKMARK_REQUESTS_PER_MINUTE) {
      return false;
    }
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const formatCollection = (row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    postCount: row.post_count,
    isPrivate: row.is_private,
    createdAt: row.created_at,
  });

  /*
   * GET /api/bookmarks - Get all saved posts (paginated)
   */
  router.get("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const collectionId = req.query.collection_id || null;

      if (!checkRateLimit(userId)) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
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
          p.created_at,
          b.created_at AS saved_at
        FROM bookmarks b
        INNER JOIN posts p ON p.id = b.post_id
        INNER JOIN users u ON u.id = p.user_id
        WHERE b.user_id = $1
      `;

      const params = [userId];

      if (collectionId) {
        query += ` AND b.collection_id = $${params.length + 1}`;
        params.push(collectionId);
      }

      query += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        posts: result.rows.map(formatPost),
        pagination: { limit, offset, count: result.rows.length, hasMore: result.rows.length === limit },
      });
    } catch (err) {
      console.error("Get bookmarks error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * ── COLLECTIONS ROUTES ──
   * IMPORTANT: All /collections routes MUST appear before /:postId routes.
   * Otherwise Express matches "collections" as a :postId parameter value.
   */

  /*
   * GET /api/bookmarks/collections - Get saved collections
   */
  router.get("/collections", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      const result = await pool.query(
        `SELECT
          bc.id,
          bc.name,
          bc.description,
          bc.is_private,
          bc.created_at,
          COUNT(b.id) AS post_count
         FROM bookmark_collections bc
         LEFT JOIN bookmarks b ON b.collection_id = bc.id
         WHERE bc.user_id = $1
         GROUP BY bc.id, bc.name, bc.description, bc.is_private, bc.created_at
         ORDER BY bc.created_at DESC`,
        [userId]
      );

      return res.json({ success: true, collections: result.rows.map(formatCollection) });
    } catch (err) {
      console.error("Get collections error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * POST /api/bookmarks/collections - Create new collection
   */
  router.post("/collections", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { name, description, isPrivate } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ success: false, error: "Collection name required" });
      }

      const result = await pool.query(
        `INSERT INTO bookmark_collections (user_id, name, description, is_private)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, is_private, created_at`,
        [userId, name.trim(), description || null, isPrivate || false]
      );

      return res.json({ success: true, collection: formatCollection(result.rows[0]) });
    } catch (err) {
      console.error("Create collection error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * PUT /api/bookmarks/collections/:id - Update collection
   */
  router.put("/collections/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const collectionId = parseInt(req.params.id, 10);
      const { name, description, isPrivate } = req.body;

      if (!Number.isInteger(collectionId)) {
        return res.status(400).json({ success: false, error: "Invalid collection ID" });
      }

      const result = await pool.query(
        `UPDATE bookmark_collections
         SET
           name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_private = COALESCE($3, is_private)
         WHERE id = $4 AND user_id = $5
         RETURNING id, name, description, is_private, created_at`,
        [name, description, isPrivate, collectionId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Collection not found" });
      }

      return res.json({ success: true, collection: formatCollection(result.rows[0]) });
    } catch (err) {
      console.error("Update collection error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * DELETE /api/bookmarks/collections/:id - Delete collection
   */
  router.delete("/collections/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const collectionId = parseInt(req.params.id, 10);

      if (!Number.isInteger(collectionId)) {
        return res.status(400).json({ success: false, error: "Invalid collection ID" });
      }

      const result = await pool.query(
        `DELETE FROM bookmark_collections WHERE id = $1 AND user_id = $2 RETURNING id`,
        [collectionId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Collection not found" });
      }

      return res.json({ success: true, collectionId });
    } catch (err) {
      console.error("Delete collection error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * ── PARAMETERIZED ROUTES (must come after all /collections routes) ──
   */

  /*
   * POST /api/bookmarks/:postId - Save a post
   */
  router.post("/:postId", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const postId = parseInt(req.params.postId, 10);
      const collectionId = req.body.collection_id || null;

      if (!checkRateLimit(userId)) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
      }

      if (!Number.isInteger(postId)) {
        return res.status(400).json({ success: false, error: "Invalid post ID" });
      }

      await client.query("BEGIN");

      const postCheck = await client.query(`SELECT id FROM posts WHERE id = $1`, [postId]);

      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      if (collectionId) {
        const collectionCheck = await client.query(
          `SELECT id FROM bookmark_collections WHERE id = $1 AND user_id = $2`,
          [collectionId, userId]
        );

        if (collectionCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ success: false, error: "Collection not found" });
        }
      }

      const result = await client.query(
        `INSERT INTO bookmarks (user_id, post_id, collection_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, post_id)
         DO UPDATE SET collection_id = EXCLUDED.collection_id, created_at = NOW()
         RETURNING id, created_at`,
        [userId, postId, collectionId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        bookmark: { id: result.rows[0].id, postId, savedAt: result.rows[0].created_at },
      });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch (rollbackError) {
        console.error("Bookmark rollback error:", rollbackError.message);
      }
      console.error("Save post error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /*
   * DELETE /api/bookmarks/:postId - Unsave a post
   */
  router.delete("/:postId", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const postId = parseInt(req.params.postId, 10);

      if (!checkRateLimit(userId)) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
      }

      if (!Number.isInteger(postId)) {
        return res.status(400).json({ success: false, error: "Invalid post ID" });
      }

      const result = await pool.query(
        `DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2 RETURNING id`,
        [userId, postId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Bookmark not found" });
      }

      return res.json({ success: true, postId });
    } catch (err) {
      console.error("Delete bookmark error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * POST /api/bookmarks/:postId/collection - Add post to collection
   */
  router.post("/:postId/collection", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const postId = parseInt(req.params.postId, 10);
      const collectionId = parseInt(req.body.collection_id, 10);

      if (!Number.isInteger(postId) || !Number.isInteger(collectionId)) {
        return res.status(400).json({ success: false, error: "Invalid post or collection ID" });
      }

      const result = await pool.query(
        `UPDATE bookmarks SET collection_id = $1 WHERE user_id = $2 AND post_id = $3 RETURNING id`,
        [collectionId, userId, postId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Bookmark not found" });
      }

      return res.json({
        success: true,
        bookmark: { id: result.rows[0].id, postId, collectionId },
      });
    } catch (err) {
      console.error("Add to collection error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  return router;
};
