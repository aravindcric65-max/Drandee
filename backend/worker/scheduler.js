const { pool } = require('../config/database');
const crypto = require('crypto');
const { schedulerLogger } = require('../utils/logger');

const sLog = schedulerLogger();

let intervalId;
const LOCK_KEY = 'scheduler_lock';
const LOCK_TTL = 60; // 60 seconds

// Safe Lua script to release lock only if the token matches
const releaseLockScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

async function checkPendingDeletions(connection) {
  const token = crypto.randomUUID();
  let lockAcquired = false;

  try {
    // 1. Attempt to acquire distributed lock
    const result = await connection.set(LOCK_KEY, token, 'NX', 'EX', LOCK_TTL);
    if (result !== 'OK') {
      // Another scheduler is running, skip this sweep
      return;
    }
    lockAcquired = true;

    // We import Queue dynamically to avoid circular dependencies if needed, or pass connection
    const { Queue } = require('bullmq');
    const accountDeletionQueue = new Queue('AccountDeletion', { connection });

    // 2. Postgres Atomic Claim
    // Find eligible requests: status is PENDING, scheduled_for is in the past
    // We lock it by updating status to SCHEDULING temporarily, so no other scheduler picks it up
    const res = await pool.query(`
      UPDATE account_deletion_requests 
      SET status = 'SCHEDULING', updated_at = NOW() 
      WHERE status = 'PENDING' AND scheduled_for <= NOW()
      RETURNING user_id
    `);

    for (const row of res.rows) {
      sLog.info({ userId: row.user_id }, 'Queueing account deletion');
      // Stable idempotent job ID based on user_id
      await accountDeletionQueue.add('deleteAccount', { userId: row.user_id }, {
        jobId: `account-deletion:${row.user_id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: { age: 3600 * 24 * 7, count: 100 }
      });
    }

    // 3. Cleanup of EXPIRED data_export_jobs
    const expiredRes = await pool.query(`
      UPDATE data_export_jobs
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE status = 'COMPLETED' AND expires_at <= NOW()
      RETURNING file_url
    `);

    if (expiredRes.rows.length > 0) {
      const StorageAbstraction = require('../utils/storage');
      for (const row of expiredRes.rows) {
        if (row.file_url) {
          sLog.info('Deleting expired export file');
          await StorageAbstraction.delete(row.file_url);
        }
      }
    }

  } catch (err) {
    sLog.error({ err }, 'Error checking pending tasks');
  } finally {
    // 4. Safe Lock Release
    if (lockAcquired) {
      try {
        await connection.eval(releaseLockScript, 1, LOCK_KEY, token);
      } catch (releaseErr) {
        sLog.error({ err: releaseErr }, 'Failed to release scheduler lock');
      }
    }
  }
}

function start(connection) {
  sLog.info('Scheduler started — checking pending deletions and expired exports every 5 minutes');
  // Check immediately
  checkPendingDeletions(connection);
  // Then every 5 minutes
  intervalId = setInterval(() => checkPendingDeletions(connection), 5 * 60 * 1000);
}

function stop() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { start, stop, checkPendingDeletions };
