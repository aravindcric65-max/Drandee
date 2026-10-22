const { pool } = require('../../config/database');

/**
 * BullMQ Analytics Job Handler
 * 
 * Job data expects:
 * - userId (string, required)
 * - eventType (string, required)
 * - data (object, optional)
 * - timestamp (string/date, optional)
 */
module.exports = async function analyticsHandler(jobData) {
  const { userId, eventType, data, timestamp } = jobData;
  if (!userId || !eventType) throw new Error("userId and eventType are required for analytics job");

  const client = await pool.connect();
  try {
    const ts = timestamp || new Date().toISOString();
    
    if (eventType === 'feed_outcome') {
      const { recordFeedOutcome } = require('../../models/feedAnalyticsModel');
      await recordFeedOutcome(client, data);
      console.log(`[Analytics] Processed feed_outcome for user ${userId}`);
    } else if (eventType === 'watch_event') {
      // Re-implemented from events.js
      const { postId, watchTime, videoDuration, completionPercent, isRespected, isSaved, variant } = data;
      
      const priorSession = await client.query(
        `SELECT id FROM watch_sessions WHERE user_id = $1 AND post_id = $2 LIMIT 1`,
        [userId, postId]
      );
      const isFirstWatch = priorSession.rows.length === 0;

      await client.query(
        `INSERT INTO watch_sessions (
          user_id, post_id, watch_time, video_duration, completion_percent, is_respected, is_saved, last_watched_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id, post_id) DO UPDATE SET
          watch_time = GREATEST(watch_sessions.watch_time, EXCLUDED.watch_time),
          completion_percent = GREATEST(watch_sessions.completion_percent, EXCLUDED.completion_percent),
          is_respected = watch_sessions.is_respected OR EXCLUDED.is_respected,
          is_saved = watch_sessions.is_saved OR EXCLUDED.is_saved,
          last_watched_at = NOW()`,
        [userId, postId, watchTime, videoDuration, completionPercent, isRespected, isSaved]
      );

      if (isFirstWatch) {
        await client.query(
          `UPDATE posts SET
             total_watch_time = COALESCE(total_watch_time, 0) + $1,
             watch_count = COALESCE(watch_count, 0) + 1,
             avg_completion_rate = (COALESCE(avg_completion_rate, 0) * COALESCE(watch_count, 0) + $2) / (COALESCE(watch_count, 0) + 1)
           WHERE id = $3`,
          [watchTime, completionPercent, postId]
        );
      } else {
        await client.query(
          `UPDATE posts SET
             total_watch_time = COALESCE(total_watch_time, 0) + $1,
             avg_completion_rate = CASE
               WHEN COALESCE(watch_count, 0) > 0 THEN (COALESCE(avg_completion_rate, 0) * COALESCE(watch_count, 0) + $2) / COALESCE(watch_count, 0)
               ELSE $2 END
           WHERE id = $3`,
          [watchTime, completionPercent, postId]
        );
      }

      // We skip the calculateEngagementScore dopamine update here for brevity, or we can just run a simplified version:
      let score = 0;
      if (completionPercent >= 90) score += 50; else if (completionPercent >= 70) score += 35; else if (completionPercent >= 50) score += 20; else if (completionPercent >= 25) score += 10;
      if (watchTime >= 30000) score += 20; else if (watchTime >= 15000) score += 10; else if (watchTime >= 5000) score += 5;
      if (isRespected) score += 20;
      if (isSaved) score += 10;
      score = Math.min(score, 100);

      await client.query(
        `UPDATE users SET last_dopamine_score = $1, avg_dopamine_score = COALESCE(avg_dopamine_score, 0) * 0.7 + $1 * 0.3, last_active_at = NOW() WHERE id = $2`,
        [score, userId]
      );
      
      console.log(`[Analytics] Processed watch_event for user ${userId}, post ${postId} (Variant: ${variant})`);
    } else {
      // Fallback
      await client.query(`INSERT INTO feed_events (user_id, event_type, event_data, created_at) VALUES ($1, $2, $3, $4)`, [userId, eventType, data || {}, ts]);
    }
  } catch (err) {
    if (err.code === '42P01') {
      console.warn(`[Analytics] Missing table gracefully handled.`);
    } else {
      console.error(`[Analytics] Job error:`, err);
      throw err;
    }
  } finally {
    client.release();
  }
};
