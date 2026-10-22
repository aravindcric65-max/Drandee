const express = require("express");
const authMiddleware = require("../middleware/auth");

module.exports = (pool) => {
  const router = express.Router();

  // POST /api/drafts - Create or update a draft
  router.post("/", authMiddleware, async (req, res) => {
    try {
      const { draftId, mediaUrls, edits, caption, hashtags, audioId, coverUrl, privacy, settings } = req.body;
      const userId = req.auth.userId;

      let result;
      if (draftId) {
        // Update existing draft
        result = await pool.query(
          `UPDATE drafts SET
             media_urls = $1, edits = $2, caption = $3, hashtags = $4,
             audio_id = $5, cover_url = $6, privacy = $7, settings = $8, updated_at = NOW()
           WHERE id = $9 AND user_id = $10
           RETURNING *`,
          [
            mediaUrls || [], edits || {}, caption || "", hashtags || [],
            audioId || null, coverUrl || null, privacy || 'public', settings || {},
            draftId, userId
          ]
        );
      } else {
        // Create new draft
        result = await pool.query(
          `INSERT INTO drafts (user_id, media_urls, edits, caption, hashtags, audio_id, cover_url, privacy, settings)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            userId, mediaUrls || [], edits || {}, caption || "", hashtags || [],
            audioId || null, coverUrl || null, privacy || 'public', settings || {}
          ]
        );
      }

      res.status(201).json({ success: true, draft: result.rows[0] });
    } catch (error) {
      console.error("Save draft error:", error);
      res.status(500).json({ success: false, error: "Failed to save draft" });
    }
  });

  // GET /api/drafts - Get all user's drafts
  router.get("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const result = await pool.query(
        `SELECT * FROM drafts WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId]
      );
      res.json({ success: true, drafts: result.rows });
    } catch (error) {
      console.error("Get drafts error:", error);
      res.status(500).json({ success: false, error: "Failed to load drafts" });
    }
  });

  // GET /api/drafts/:id - Get specific draft
  router.get("/:id", authMiddleware, async (req, res) => {
    try {
      const draftId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;

      const result = await pool.query(
        `SELECT * FROM drafts WHERE id = $1 AND user_id = $2`,
        [draftId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Draft not found" });
      }

      res.json({ success: true, draft: result.rows[0] });
    } catch (error) {
      console.error("Get draft error:", error);
      res.status(500).json({ success: false, error: "Failed to load draft" });
    }
  });

  // DELETE /api/drafts/:id - Delete draft
  router.delete("/:id", authMiddleware, async (req, res) => {
    try {
      const draftId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;

      const result = await pool.query(
        `DELETE FROM drafts WHERE id = $1 AND user_id = $2 RETURNING id`,
        [draftId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Draft not found or unauthorized" });
      }

      res.json({ success: true, message: "Draft deleted successfully" });
    } catch (error) {
      console.error("Delete draft error:", error);
      res.status(500).json({ success: false, error: "Failed to delete draft" });
    }
  });

  return router;
};
