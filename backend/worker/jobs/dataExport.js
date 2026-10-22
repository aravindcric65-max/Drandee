const { pool } = require('../../config/database');
const StorageAbstraction = require('../../utils/storage');

/**
 * BullMQ Data Export Job Handler
 * 
 * Flow:
 * 1. Mark job as PROCESSING
 * 2. Collect authorized user data
 * 3. Generate JSON export
 * 4. Save to private storage
 * 5. Mark job as COMPLETED with expires_at
 */
async function dataExportHandler({ jobId, userId }) {
  // 1. Update status to PROCESSING
  await pool.query(`UPDATE data_export_jobs SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1`, [jobId]);

  try {
    const exportData = {};

    // Collect Account Data
    const userRes = await pool.query(
      `SELECT id, name, username, email, phone, bio, city, birthday, niche, profile_pic, is_protected, is_verified, created_at, account_status 
       FROM users WHERE id = $1`, [userId]
    );
    if (userRes.rows.length === 0) {
      throw new Error("User no longer exists");
    }
    exportData.account = userRes.rows[0];

    // Collect Privacy Settings
    const privacyRes = await pool.query(`SELECT * FROM privacy_settings WHERE user_id = $1`, [userId]);
    exportData.privacy = privacyRes.rows[0] || {};

    // Collect Notification Settings
    const notifRes = await pool.query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [userId]);
    exportData.notifications = notifRes.rows[0] || {};

    // Collect Comments
    const commentsRes = await pool.query(`SELECT id, content, created_at FROM comments WHERE user_id = $1`, [userId]);
    exportData.comments = commentsRes.rows;

    // Collect Respects Given (NOT Likes)
    const respectsGiven = await pool.query(
      `SELECT cr.id, c.content as comment_content, cr.created_at 
       FROM comment_respects cr 
       JOIN comments c ON cr.comment_id = c.id 
       WHERE cr.user_id = $1`, [userId]
    );
    exportData.respects_given = respectsGiven.rows;

    // Collect Respects Received (NOT Likes)
    const respectsReceived = await pool.query(
      `SELECT cr.id, c.content as comment_content, cr.created_at 
       FROM comment_respects cr 
       JOIN comments c ON cr.comment_id = c.id 
       WHERE c.user_id = $1`, [userId]
    );
    exportData.respects_received = respectsReceived.rows;

    // Collect Saves
    const savesRes = await pool.query(
      `SELECT sp.id, p.content as post_content, sp.created_at 
       FROM saved_posts sp 
       JOIN posts p ON sp.post_id = p.id 
       WHERE sp.user_id = $1`, [userId]
    );
    exportData.saves = savesRes.rows;

    // Format export payload
    const exportPayload = JSON.stringify(exportData, null, 2);
    const fileName = `export_${jobId}.json`;

    // Save to secure storage
    await StorageAbstraction.save(fileName, exportPayload);

    // Mark as completed, expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(
      `UPDATE data_export_jobs SET status = 'COMPLETED', file_url = $1, expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [fileName, expiresAt, jobId]
    );

    return { success: true, file: fileName };
  } catch (error) {
    // Mark as failed safely
    await pool.query(`UPDATE data_export_jobs SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [jobId]);
    throw error;
  }
}

module.exports = dataExportHandler;
