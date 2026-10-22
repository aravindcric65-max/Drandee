const express = require("express");
const authMiddleware = require("../middleware/auth");

module.exports = (pool) => {
  const router = express.Router();

  /* ─── Links ─── */

  // GET /api/profile/links/:userId - Get user links (public, no auth required)
  router.get("/links/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT id, title, url, position, is_active, clicks, created_at
         FROM user_links
         WHERE user_id = $1 AND is_active = true
         ORDER BY position ASC, created_at DESC`,
        [userId]
      );
      res.json({ success: true, links: result.rows });
    } catch (err) {
      console.error("Get links error:", err.message);
      res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // POST /api/profile/links - Create link
  router.post("/links", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { title, url } = req.body;
      if (!title || !url) return res.status(400).json({ error: "Title and URL required" });

      const countRes = await pool.query(`SELECT COUNT(*) FROM user_links WHERE user_id = $1`, [userId]);
      const position = parseInt(countRes.rows[0].count);

      const result = await pool.query(
        `INSERT INTO user_links (user_id, title, url, position) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, title, url, position]
      );
      res.json({ success: true, link: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // PUT /api/profile/links/:id - Update/Reorder
  router.put("/links/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const linkId = req.params.id;
      const { title, url, is_active, position } = req.body;

      // Ensure ownership
      const check = await pool.query(`SELECT id FROM user_links WHERE id = $1 AND user_id = $2`, [linkId, userId]);
      if (check.rows.length === 0) return res.status(403).json({ error: "Unauthorized" });

      const updates = [];
      const values = [];
      let idx = 1;

      if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
      if (url !== undefined) { updates.push(`url = $${idx++}`); values.push(url); }
      if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }
      if (position !== undefined) { updates.push(`position = $${idx++}`); values.push(position); }

      if (updates.length === 0) return res.json({ success: true });

      values.push(linkId);
      const result = await pool.query(
        `UPDATE user_links SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      res.json({ success: true, link: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // DELETE /api/profile/links/:id
  router.delete("/links/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const linkId = req.params.id;
      await pool.query(`DELETE FROM user_links WHERE id = $1 AND user_id = $2`, [linkId, userId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST /api/profile/links/:id/click - Track click
  router.post("/links/:id/click", async (req, res) => {
    try {
      await pool.query(`UPDATE user_links SET clicks = clicks + 1 WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /* ─── Profile Customization ─── */
  
  // PUT /api/profile/theme
  router.put("/theme", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { theme } = req.body;
      const validThemes = ['dark', 'midnight-blue', 'neon-purple'];
      if (!validThemes.includes(theme)) return res.status(400).json({ error: "Invalid theme" });

      await pool.query(`UPDATE users SET profile_theme = $1 WHERE id = $2`, [theme, userId]);
      res.json({ success: true, theme });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
};
