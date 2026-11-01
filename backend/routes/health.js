'use strict';

const express = require('express');

module.exports = (pool, redisClient) => {
  const router = express.Router();

  /**
   * Liveness Probe (Render / K8s)
   * GET /health/live or /api/health/live
   * Returns 200 { status: 'alive' } immediately.
   */
  router.get('/live', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({ status: 'alive' });
  });

  /**
   * Readiness Probe (Render / K8s)
   * GET /health/ready or /api/health/ready
   * Checks database connectivity and redis status.
   */
  router.get('/ready', async (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    let dbStatus = 'down';
    try {
      if (pool) {
        await pool.query('SELECT 1');
        dbStatus = 'up';
      }
    } catch (err) {
      dbStatus = 'down';
    }

    let redisStatus = 'disabled';
    if (redisClient && typeof redisClient.ping === 'function') {
      try {
        await redisClient.ping();
        redisStatus = 'up';
      } catch (err) {
        redisStatus = 'down';
      }
    }

    if (dbStatus === 'up') {
      return res.status(200).json({
        status: 'ready',
        db: 'up',
        redis: redisStatus,
      });
    }

    return res.status(503).json({
      status: 'unhealthy',
      db: 'down',
      redis: redisStatus,
    });
  });

  /**
   * Root Health Check
   * GET /health or /api/health
   */
  router.get('/', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({
      success: true,
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: Date.now(),
    });
  });

  return router;
};
