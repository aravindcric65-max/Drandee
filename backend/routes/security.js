const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { getAuth } = require('../config/firebase');

// Ensure token revocation and session invalidation
router.delete('/sessions/current', authMiddleware, async (req, res) => {
  try {
    // If the frontend sent a session_id, we would delete it from PostgreSQL
    // For now, we rely on Firebase Admin to revoke ALL tokens for the user
    // Since Firebase doesn't support single-device revocation natively without a custom DB implementation,
    // and we're instructed to be careful:
    const userResult = await pool.query('SELECT firebase_uid FROM users WHERE id = $1', [req.auth.userId]);
    const firebaseUid = userResult.rows[0]?.firebase_uid;
    if (firebaseUid) {
      await getAuth().revokeRefreshTokens(firebaseUid);
    }
    
    // Also clear from Postgres if we had passed a session_id
    await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [req.auth.userId]);
    
    res.json({ success: true, message: 'Current session (and all others) revoked via Firebase.' });
  } catch (err) {
    console.error('Session revoke error:', err.message);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

router.delete('/sessions/all', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT firebase_uid FROM users WHERE id = $1', [req.auth.userId]);
    const firebaseUid = userResult.rows[0]?.firebase_uid;
    if (firebaseUid) {
      await getAuth().revokeRefreshTokens(firebaseUid);
    }
    await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [req.auth.userId]);
    
    await pool.query(
      `INSERT INTO login_history (user_id, provider, status) VALUES ($1, $2, $3)`, 
      [req.auth.userId, 'ALL', 'TERMINATED']
    );

    res.json({ success: true, message: 'All sessions revoked' });
  } catch (err) {
    console.error('All sessions revoke error:', err.message);
    res.status(500).json({ error: 'Failed to revoke all sessions' });
  }
});

router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, device, browser, platform, ip_address, last_active, created_at FROM auth_sessions WHERE user_id = $1 ORDER BY last_active DESC',
      [req.auth.userId]
    );
    res.json({ success: true, sessions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/login-history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, provider, status, device, browser, platform, ip_address, created_at FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.auth.userId]
    );
    res.json({ success: true, history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

module.exports = router;
