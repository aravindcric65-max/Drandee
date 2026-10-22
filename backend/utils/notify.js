const { pool } = require("../config/database");

/**
 * Creates a notification in the database.
 * @param {Object} params
 * @param {number} params.userId - User receiving the notification
 * @param {number} params.actorId - User performing the action
 * @param {string} params.type - 'respect', 'comment', 'follow', 'mention'
 * @param {string} params.message - The text message
 * @param {number} [params.postId] - Associated post (optional)
 * @param {string} [params.title] - Optional title
 */
const sendNotification = async ({ userId, actorId, type, message, postId = null, title = null }) => {
  if (userId === actorId) return; // Don't notify self

  try {
    // Get actor details
    const actorResult = await pool.query(
      'SELECT name, profile_pic FROM users WHERE id = $1',
      [actorId]
    );
    
    if (actorResult.rows.length === 0) return;
    const actor = actorResult.rows[0];

    await pool.query(
      `INSERT INTO notifications 
       (user_id, actor_id, type, title, message, post_id, actor_name, actor_avatar)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        actorId,
        type,
        title,
        message,
        postId,
        actor.name,
        actor.profile_pic
      ]
    );
  } catch (error) {
    console.error("Failed to insert notification:", error.message);
  }
};

module.exports = { sendNotification };
