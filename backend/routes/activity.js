const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.get('/respects-given', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT r.id as respect_id, r.created_at, p.id as post_id, p.caption as content, u.username as post_author
      FROM respects r
      JOIN posts p ON r.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE r.user_id = $1 AND p.is_deleted = false
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.auth.userId, limit, offset]);

    res.json({ success: true, activity: result.rows });
  } catch (err) {
    console.error('Respects Given error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/respects-received', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT r.id as respect_id, r.created_at, p.id as post_id, p.caption as content, u.username as respect_author
      FROM respects r
      JOIN posts p ON r.post_id = p.id
      JOIN users u ON r.user_id = u.id
      WHERE p.user_id = $1 AND p.is_deleted = false
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.auth.userId, limit, offset]);

    res.json({ success: true, activity: result.rows });
  } catch (err) {
    console.error('Respects Received error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/comments', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT id, text as content, created_at
      FROM comments
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.auth.userId, limit, offset]);

    res.json({ success: true, activity: result.rows });
  } catch (err) {
    console.error('Comments activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/saved-posts', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT sp.id as save_id, sp.created_at, p.id as post_id, p.caption as content, u.username as post_author
      FROM saved_posts sp
      JOIN posts p ON sp.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE sp.user_id = $1 AND p.is_deleted = false AND (p.content_type IS NULL OR p.content_type != 'video')
      ORDER BY sp.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.auth.userId, limit, offset]);

    res.json({ success: true, activity: result.rows });
  } catch (err) {
    console.error('Saved posts error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/saved-videos', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(`
      SELECT sp.id as save_id, sp.created_at, p.id as post_id, p.caption as content, u.username as post_author
      FROM saved_posts sp
      JOIN posts p ON sp.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE sp.user_id = $1 AND p.is_deleted = false AND p.content_type = 'video'
      ORDER BY sp.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.auth.userId, limit, offset]);

    res.json({ success: true, activity: result.rows });
  } catch (err) {
    console.error('Saved videos error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Since searches table doesn't explicitly exist, we use a placeholder or handle it if it does
router.get('/searches', authMiddleware, async (req, res) => {
  res.json({ success: true, activity: [] }); // Safe fallback if searches table is missing
});

module.exports = router;
