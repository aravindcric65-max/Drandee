const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const StorageAbstraction = require('../utils/storage');

// We configure a Redis connection for the queue producer
let dataExportQueue = null;
function getDataExportQueue() {
  if (!dataExportQueue) {
    const { Queue } = require('bullmq');
    const IORedis = require('ioredis');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    dataExportQueue = new Queue('DataExport', { connection });
  }
  return dataExportQueue;
}

router.post('/export', authMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  try {
    // Prevent spamming export requests (Rate Limiting / Idempotency)
    const check = await pool.query(
      "SELECT id FROM data_export_jobs WHERE user_id = $1 AND status IN ('QUEUED', 'PROCESSING') LIMIT 1",
      [userId]
    );
    
    if (check.rows.length > 0) {
      return res.status(429).json({ error: 'You already have an active data export job processing.' });
    }

    const result = await pool.query(
      `INSERT INTO data_export_jobs (user_id, status) VALUES ($1, 'QUEUED') RETURNING id, status, created_at`,
      [userId]
    );

    const jobRecord = result.rows[0];

    // Push to BullMQ Worker
    const queue = getDataExportQueue();
    await queue.add('exportData', { 
      jobId: jobRecord.id, 
      userId
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
      removeOnFail: 1000,
      jobId: `export_${jobRecord.id}`
    });

    res.json({ success: true, job: jobRecord, message: 'Data export queued. This will be processed by background workers.' });
  } catch (err) {
    console.error('Data export queue error:', err);
    res.status(500).json({ error: 'Failed to queue data export' });
  }
});

router.get('/export', authMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  try {
    const result = await pool.query(
      'SELECT id, status, file_url, expires_at, created_at FROM data_export_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    res.json({ success: true, jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data exports' });
  }
});

// Secure download endpoint for exports
router.get('/export/:jobId/download', authMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  try {
    const { jobId } = req.params;

    // 1. Verify Ownership & Status
    const result = await pool.query(
      'SELECT id, user_id, status, file_url, expires_at FROM data_export_jobs WHERE id = $1',
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Export not found.' });
    }

    const job = result.rows[0];

    if (job.user_id !== userId) {
      // IDOR protection — uses canonical req.auth.userId
      return res.status(403).json({ error: 'Unauthorized access to export.' });
    }

    if (job.status !== 'COMPLETED' || !job.file_url) {
      return res.status(400).json({ error: 'Export is not ready for download.' });
    }

    if (new Date(job.expires_at) <= new Date()) {
      return res.status(410).json({ error: 'Export link has expired.' });
    }

    // 2. Stream securely
    const exists = await StorageAbstraction.exists(job.file_url);
    if (!exists) {
      return res.status(404).json({ error: 'Export file missing or expired.' });
    }

    const fileBuffer = await StorageAbstraction.read(job.file_url);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="drandee_export_${new Date().toISOString().slice(0,10)}.json"`);
    res.send(fileBuffer);
    
  } catch (err) {
    console.error('Export download error:', err);
    res.status(500).json({ error: 'Failed to download export' });
  }
});

router.post('/deletion/request', authMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  
  try {
    const check = await pool.query('SELECT status FROM account_deletion_requests WHERE user_id = $1', [userId]);
    
    if (check.rows.length > 0 && check.rows[0].status === 'PENDING') {
      return res.status(400).json({ error: 'Account deletion already scheduled.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(
        `INSERT INTO account_deletion_requests (user_id, status, scheduled_for) 
         VALUES ($1, 'PENDING', NOW() + INTERVAL '30 days')
         ON CONFLICT (user_id) DO UPDATE SET status = 'PENDING', scheduled_for = NOW() + INTERVAL '30 days', updated_at = NOW()`,
        [userId]
      );

      await client.query(`UPDATE users SET account_status = 'DELETION_PENDING' WHERE id = $1`, [userId]);

      await client.query('COMMIT');
      
      res.json({ success: true, message: 'Account scheduled for deletion in 30 days.' });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Account deletion request error:', err);
      res.status(500).json({ error: 'Failed to schedule account deletion' });
    } finally {
      client.release();
    }
  } catch (outerErr) {
    console.error('Deletion request outer error:', outerErr);
    res.status(500).json({ error: 'Failed to schedule account deletion' });
  }
});

router.get('/deletion/status', authMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  try {
    const check = await pool.query(
      "SELECT status, scheduled_for, created_at FROM account_deletion_requests WHERE user_id = $1 AND status = 'PENDING' ORDER BY updated_at DESC LIMIT 1",
      [userId]
    );
    const isPending = check.rows.length > 0;
    res.json({
      success: true,
      pending: isPending,
      scheduledFor: isPending ? check.rows[0].scheduled_for : null
    });
  } catch (err) {
    console.error('Deletion status error:', err);
    res.status(500).json({ error: 'Failed to check deletion status' });
  }
});

router.post('/deletion/cancel', authMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE account_deletion_requests SET status = 'CANCELLED', updated_at = NOW() WHERE user_id = $1 AND status = 'PENDING' RETURNING id`,
        [userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No pending deletion request found.' });
      }

      await client.query(`UPDATE users SET account_status = 'ACTIVE' WHERE id = $1`, [userId]);
      
      await client.query('COMMIT');
      res.json({ success: true, message: 'Account deletion cancelled.' });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      res.status(500).json({ error: 'Failed to cancel account deletion' });
    } finally {
      client.release();
    }
  } catch (outerErr) {
    console.error('Deletion cancel outer error:', outerErr);
    res.status(500).json({ error: 'Failed to cancel account deletion' });
  }
});

module.exports = router;
