const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const VALID_CATEGORIES = [
  'Music', 'Art', 'Comedy', 'Dance', 'Gaming',
  'Education', 'Technology', 'Photography', 'Fashion', 'Storytelling', 'Other'
];

const feedbackLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many submissions. Please try again tomorrow.' }
});

const notifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

// POST /api/spotlight/feedback
router.post('/feedback', authMiddleware, feedbackLimiter, async (req, res) => {
  try {
    const { categories = [], feedback_text = '' } = req.body;
    const userId = req.auth.userId;

    // Validate categories
    if (!Array.isArray(categories) || categories.some(c => !VALID_CATEGORIES.includes(c))) {
      return res.status(400).json({ success: false, error: 'Invalid categories' });
    }
    if (categories.length > 5) {
      return res.status(400).json({ success: false, error: 'Too many categories selected' });
    }

    // Sanitize text
    const text = String(feedback_text || '').slice(0, 500).trim();

    // Check duplicate (1 per user per day)
    const dupCheck = await pool.query(
      `SELECT id FROM spotlight_feedback WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
      [userId]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(429).json({ success: false, error: 'Already submitted feedback today.' });
    }

    const result = await pool.query(
      `INSERT INTO spotlight_feedback (user_id, categories, feedback_text) VALUES ($1, $2, $3) RETURNING id`,
      [userId, categories, text]
    );

    return res.status(200).json({
      success: true,
      message: 'Thanks for your feedback!',
      feedback_id: result.rows[0].id
    });
  } catch (err) {
    console.error('Spotlight feedback error:', err);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/spotlight/notify
router.post('/notify', authMiddleware, notifyLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.auth.userId;

    // Check duplicate
    const dupCheck = await pool.query(
      `SELECT id FROM spotlight_notifications WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(200).json({ success: true, message: "You're already on the list!", already: true });
    }

    const result = await pool.query(
      `INSERT INTO spotlight_notifications (user_id, email, notified) VALUES ($1, $2, false) RETURNING id`,
      [userId, email || null]
    );

    return res.status(200).json({
      success: true,
      message: "You're on the list!",
      notification_id: result.rows[0].id
    });
  } catch (err) {
    console.error('Spotlight notify error:', err);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
