const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.auth.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const result = await pool.query(
      'SELECT private_account, messaging_control, comments_control, mentions_control, tags_control, activity_visibility FROM privacy_settings WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      // Return defaults if no row exists
      return res.json({
        success: true,
        privacy: {
          private_account: false,
          messaging_control: 'EVERYONE',
          comments_control: 'EVERYONE',
          mentions_control: 'EVERYONE',
          tags_control: 'EVERYONE',
          activity_visibility: true
        }
      });
    }

    res.json({ success: true, privacy: result.rows[0] });
  } catch (err) {
    console.error('Privacy fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch privacy settings' });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const allowedFields = [
    'private_account',
    'messaging_control',
    'comments_control',
    'mentions_control',
    'tags_control',
    'activity_visibility'
  ];
  
  const updates = [];
  const values = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(req.body[field]);
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  values.push(userId);
  
  try {
    // Insert if not exists, otherwise update
    const check = await pool.query('SELECT 1 FROM privacy_settings WHERE user_id = $1', [userId]);
    
    if (check.rows.length === 0) {
      await pool.query('INSERT INTO privacy_settings (user_id) VALUES ($1)', [userId]);
    }
    
    const query = `
      UPDATE privacy_settings 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE user_id = $${paramIndex} 
      RETURNING *
    `;

    const result = await pool.query(query, values);
    res.json({ success: true, privacy: result.rows[0] });
  } catch (err) {
    console.error('Privacy update error:', err.message);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

module.exports = router;
