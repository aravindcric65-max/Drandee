const { pool } = require('../../config/database');
const admin = require('firebase-admin');
const ImageKit = require('imagekit');

let imagekit = null;
if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
  });
}

/**
 * BullMQ Account Deletion Job Handler
 * 
 * State Machine:
 * PROCESSING -> MEDIA_CLEANUP -> FIREBASE_CLEANUP -> DATABASE_CLEANUP -> COMPLETED
 */
async function accountDeletionHandler({ userId }) {
  const checkStatus = async () => {
    const res = await pool.query(`SELECT status, firebase_uid FROM account_deletion_requests r JOIN users u ON r.user_id = u.id WHERE user_id = $1`, [userId]);
    if (res.rows.length === 0) throw new Error('Deletion request missing');
    return res.rows[0];
  };

  const updateStatus = async (status) => {
    await pool.query(`UPDATE account_deletion_requests SET status = $1, updated_at = NOW() WHERE user_id = $2`, [status, userId]);
  };

  try {
    let state = await checkStatus();
    
    // Safety check: is it already completed or cancelled?
    if (state.status === 'COMPLETED' || state.status === 'CANCELLED') {
      return { success: true, message: 'Already processed or cancelled' };
    }

    if (state.status === 'PENDING') {
      await updateStatus('PROCESSING');
      state.status = 'PROCESSING';
    }

    if (state.status === 'PROCESSING') {
      await updateStatus('MEDIA_CLEANUP');
      state.status = 'MEDIA_CLEANUP';
    }

    if (state.status === 'MEDIA_CLEANUP') {
      const { Queue } = require('bullmq');
      const IORedis = require('ioredis');
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      const mediaCleanupQueue = new Queue('MediaCleanup', { connection });

      // Fetch all canonical media for this user
      const mediaRes = await pool.query(`SELECT id, storage_provider, provider_file_id, url FROM media WHERE user_id = $1`, [userId]);
      
      console.log(`[Deletion] Found ${mediaRes.rows.length} canonical media records for user ${userId}. Queueing cleanup...`);
      for (const m of mediaRes.rows) {
        if (!m.provider_file_id && m.storage_provider === 'imagekit') {
           console.warn(`[Deletion] Skipping ImageKit cleanup for media ${m.id} - Missing canonical provider_file_id limitation.`);
           continue; // DO NOT guess IDs or perform wildcard deletion
        }
        await mediaCleanupQueue.add('cleanupMedia', { 
          mediaId: m.id,
          storage_provider: m.storage_provider,
          provider_file_id: m.provider_file_id,
          url: m.url 
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          jobId: `cleanup_media_${m.id}`
        });
      }
      await connection.quit();

      await updateStatus('FIREBASE_CLEANUP');
      state.status = 'FIREBASE_CLEANUP';
    }

    if (state.status === 'FIREBASE_CLEANUP') {
      if (state.firebase_uid) {
        try {
          await admin.auth().deleteUser(state.firebase_uid);
          console.log(`[Deletion] Firebase User ${state.firebase_uid} deleted.`);
        } catch (fbErr) {
          if (fbErr.code === 'auth/user-not-found') {
            console.log(`[Deletion] Firebase User ${state.firebase_uid} already deleted.`);
          } else {
            throw fbErr; // Retryable error
          }
        }
      }
      await updateStatus('DATABASE_CLEANUP');
      state.status = 'DATABASE_CLEANUP';
    }

    if (state.status === 'DATABASE_CLEANUP') {
      // PostgreSQL ON DELETE CASCADE handles most relationships.
      await pool.query('BEGIN');
      
      // Delete user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      
      // Since account_deletion_requests is tied via ON DELETE CASCADE to users,
      // deleting the user also deletes the request record.
      // If we want an audit trail, we should insert into a separate audit log table first.
      await pool.query(`
        INSERT INTO login_history (user_id, provider, status) 
        VALUES ($1, 'SYSTEM', 'ACCOUNT_DELETED')
      `, [userId]); // user_id in login_history might also cascade, so we'd need an immutable audit log, 
                   // but for Phase 3C we accept the standard CASCADE wipe. 
                   // If login_history is tied via FK, it deletes too. That's true erasure.
      
      await pool.query('COMMIT');
      console.log(`[Deletion] Database user ${userId} cascaded and deleted.`);
      
      return { success: true };
    }
  } catch (error) {
    // If we fail during any stage, mark as FAILED_RETRYABLE if the record still exists
    try {
      await updateStatus('FAILED_RETRYABLE');
    } catch (e) {
      console.error(`[Deletion] Error updating failure state (maybe user already deleted):`, e.message);
    }
    throw error;
  }
}

module.exports = accountDeletionHandler;
