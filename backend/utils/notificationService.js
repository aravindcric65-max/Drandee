/**
 * Notification Service
 * Centralized utility for creating notifications across the platform
 * Used by engagement routes, user routes, etc.
 */

const NOTIFICATION_TYPES = {
  RESPECT: 'respect',
  COMMENT: 'comment',
  REPLY: 'reply',
  FOLLOW: 'follow',
  FOLLOW_REQUEST: 'follow_request',
  MENTION: 'mention',
  POST_FEATURED: 'post_featured',
  MILESTONE: 'milestone',
  SYSTEM: 'system'
};

/**
 * Create a notification
 * @param {object} pool - PostgreSQL pool
 * @param {object} options - Notification options
 * @param {number} options.userId - Target user ID (recipient)
 * @param {string} options.type - Notification type (respect, comment, follow, etc.)
 * @param {number} options.actorId - User ID who triggered the notification
 * @param {number} [options.postId] - Related post ID (optional)
 * @param {number} [options.commentId] - Related comment ID (optional)
 * @param {string} [options.message] - Custom message (optional)
 * @param {object} [options.metadata] - Additional metadata (optional)
 * @returns {Promise<object>} Created notification object
 */
async function createNotification(pool, options) {
  const {
    userId,
    type,
    actorId,
    postId = null,
    commentId = null,
    message = null,
    metadata = null
  } = options;

  // Validate required fields
  if (!userId || !type || !actorId) {
    throw new Error('userId, type, and actorId are required');
  }

  // Validate notification type
  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  // Don't send notification if user is notifying themselves
  if (userId === actorId) {
    return null;
  }

  try {
    // Insert notification
    const result = await pool.query(
      `INSERT INTO notifications 
       (user_id, type, actor_id, post_id, comment_id, message, metadata, read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
       RETURNING *`,
      [
        userId,
        type,
        actorId,
        postId,
        commentId,
        message,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    const notification = result.rows[0];

    // TODO: If WebSocket/push notification system exists, emit event here
    // emitToUser(userId, 'new_notification', notification);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Mark notification(s) as read
 * @param {object} pool - PostgreSQL pool
 * @param {number} userId - User ID
 * @param {number|number[]} notificationIds - Single ID or array of IDs
 * @returns {Promise<number>} Number of notifications marked as read
 */
async function markAsRead(pool, userId, notificationIds) {
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];

  if (ids.length === 0) return 0;

  try {
    const result = await pool.query(
      `UPDATE notifications 
       SET read = true, read_at = NOW()
       WHERE id = ANY($1) AND user_id = $2 AND read = false
       RETURNING id`,
      [ids, userId]
    );

    return result.rowCount;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
}

/**
 * Get notifications for a user
 * @param {object} pool - PostgreSQL pool
 * @param {number} userId - User ID
 * @param {object} options - Query options
 * @param {number} [options.limit=20] - Max notifications to return
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {boolean} [options.unreadOnly=false] - Only return unread notifications
 * @returns {Promise<object>} Notifications with metadata
 */
async function getNotifications(pool, userId, options = {}) {
  const {
    limit = 20,
    offset = 0,
    unreadOnly = false
  } = options;

  try {
    const conditions = ['n.user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
      conditions.push('n.read = false');
    }

    const query = `
      SELECT 
        n.*,
        u.username as actor_username,
        u.name as actor_name,
        u.profile_pic as actor_avatar,
        p.caption as post_caption,
        p.thumbnail_url as post_thumbnail
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      LEFT JOIN posts p ON n.post_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get unread count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
      [userId]
    );

    return {
      notifications: result.rows,
      unreadCount: parseInt(countResult.rows[0].count),
      hasMore: result.rows.length === limit
    };
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
}

/**
 * Delete old read notifications (cleanup utility)
 * @param {object} pool - PostgreSQL pool
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {Promise<number>} Number of notifications deleted
 */
async function cleanupOldNotifications(pool, daysOld = 30) {
  try {
    const result = await pool.query(
      `DELETE FROM notifications 
       WHERE read = true 
       AND created_at < NOW() - INTERVAL '${daysOld} days'
       RETURNING id`
    );

    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    throw error;
  }
}

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  markAsRead,
  getNotifications,
  cleanupOldNotifications
};
