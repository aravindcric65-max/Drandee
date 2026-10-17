const express = require("express");
const authMiddleware = require("../middleware/auth");

const { trackAction, getVelocity } = require("../utils/engagementVelocity");

module.exports = (pool) => {
  const router = express.Router();

  const { checkProgressiveRateLimit, redisClient: redis } = require("../utils/antiBot");
  const MAX_TRACK_REQUESTS_PER_MINUTE = 60;

  const toNumber = (value, fallback = 0) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  };

  const toBoolean = (value) => {
    return value === true || value === "true";
  };

  const calculateEngagementScore = (completion, watchTime, respected, saved) => {
    let score = 0;

    if (completion >= 90) score += 50;
    else if (completion >= 70) score += 35;
    else if (completion >= 50) score += 20;
    else if (completion >= 25) score += 10;

    if (watchTime >= 30000) score += 20;
    else if (watchTime >= 15000) score += 10;
    else if (watchTime >= 5000) score += 5;

    if (respected) score += 20;
    if (saved) score += 10;

    return Math.min(score, 100);
  };

  const jwt = require('jsonwebtoken');
  const WATCH_SECRET = process.env.JWT_SECRET || 'fallback-watch-secret-for-dev-only';

  /*
   * POST /api/watch/track
   */
  router.post("/track", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const postId = parseInt(req.body.post_id, 10);
      const videoDuration = toNumber(req.body.video_duration);
      const requestedWatchTime = toNumber(req.body.watch_time);
      const isRespected = toBoolean(req.body.is_respected);
      const isSaved = toBoolean(req.body.is_saved);
      const progressEvents = req.body.progress_events || [];
      const sessionToken = req.body.session_token;

      // Progressive rate limit check
      const allowed = await checkProgressiveRateLimit(userId, "watch", 60000, MAX_TRACK_REQUESTS_PER_MINUTE);
      if (!allowed) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
      }

      if (!Number.isInteger(postId)) {
        return res.status(400).json({ success: false, error: "post_id is required and must be a number" });
      }

      const isStart = requestedWatchTime === 0 && !sessionToken;

      await client.query("BEGIN");

      // Verify post and actual duration
      const postCheck = await client.query(
        `SELECT id, duration FROM posts WHERE id = $1 AND is_deleted = false FOR UPDATE`,
        [postId]
      );

      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      const dbDuration = postCheck.rows[0].duration;
      // If DB has no duration, we fallback to 15s. We DO NOT trust client videoDuration unconditionally anymore.
      const actualDuration = dbDuration > 0 ? dbDuration : 15;
      
      let generatedToken = null;

      if (isStart) {
        // Generate cryptographic watch session
        const payload = {
          userId,
          postId,
          duration: actualDuration,
          sid: require('crypto').randomUUID()
        };
        // 1 hour expiration for the watch session
        generatedToken = jwt.sign(payload, WATCH_SECRET, { expiresIn: '1h', issuer: 'drandee-watch-sec' });
      } else {
        // Validate cryptographic session
        if (!sessionToken) {
          await client.query("ROLLBACK");
          return res.status(403).json({ success: false, error: "Missing watch session token" });
        }

        try {
          const decoded = jwt.verify(sessionToken, WATCH_SECRET, { issuer: 'drandee-watch-sec' });
          
          if (decoded.userId !== userId) {
            throw new Error("Session does not belong to this user");
          }
          if (decoded.postId !== postId) {
            throw new Error("Session does not belong to this post");
          }
          if (decoded.duration !== actualDuration) {
            // Duration mismatch (perhaps DB updated, or forged)
            throw new Error("Session duration mismatch");
          }
          
          const sessionLifetime = (Date.now() - (decoded.iat * 1000)) / 1000;
          const maxPhysicallyPossibleWatchTime = sessionLifetime * 1000 + 5000; // Add 5s buffer for latency

          if (requestedWatchTime > maxPhysicallyPossibleWatchTime && requestedWatchTime > 10000) {
             throw new Error("Impossible watch time relative to session lifetime");
          }
        } catch (tokenErr) {
          const { recordSecurityAnomaly } = require("../utils/antiBot");
          await recordSecurityAnomaly(userId, "forged_watch_session");
          await client.query("ROLLBACK");
          return res.status(403).json({ success: false, error: "Invalid or expired watch session" });
        }
      }

      const watchTime = Math.min(Math.max(requestedWatchTime, 0), actualDuration);
      const completionPercent = Math.min(Math.max((watchTime / actualDuration) * 100, 0), 100);

      const priorSession = await client.query(
        `SELECT id FROM watch_sessions WHERE user_id = $1 AND post_id = $2 LIMIT 1`,
        [userId, postId]
      );

      const isFirstWatch = priorSession.rows.length === 0;

      await client.query(
        `INSERT INTO watch_sessions (
          user_id, post_id, watch_time, video_duration, completion_percent, is_respected, is_saved, last_watched_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id, post_id)
        DO UPDATE SET
          watch_time = GREATEST(watch_sessions.watch_time, EXCLUDED.watch_time),
          completion_percent = GREATEST(watch_sessions.completion_percent, EXCLUDED.completion_percent),
          is_respected = watch_sessions.is_respected OR EXCLUDED.is_respected,
          is_saved = watch_sessions.is_saved OR EXCLUDED.is_saved,
          last_watched_at = NOW()`,
        [userId, postId, watchTime, actualDuration, completionPercent, isRespected, isSaved]
      );

      // Aggregations on the posts table
      if (isFirstWatch) {
        await client.query(
          `UPDATE posts SET total_watch_time = COALESCE(total_watch_time, 0) + $1, watch_count = COALESCE(watch_count, 0) + 1, avg_completion_rate = (COALESCE(avg_completion_rate, 0) * COALESCE(watch_count, 0) + $2) / (COALESCE(watch_count, 0) + 1) WHERE id = $3`,
          [watchTime, completionPercent, postId]
        );
      } else {
        await client.query(
          `UPDATE posts SET total_watch_time = COALESCE(total_watch_time, 0) + $1, avg_completion_rate = CASE WHEN COALESCE(watch_count, 0) > 0 THEN (COALESCE(avg_completion_rate, 0) * COALESCE(watch_count, 0) + $2) / COALESCE(watch_count, 0) ELSE $2 END WHERE id = $3`,
          [watchTime, completionPercent, postId]
        );
      }

      const engagementScore = calculateEngagementScore(completionPercent, watchTime, isRespected, isSaved);
      await client.query(
        `UPDATE users SET
          last_dopamine_score = $1::float8,
          avg_dopamine_score = COALESCE(avg_dopamine_score, 0) * 0.7 + $1::float8 * 0.3,
          last_active_at = NOW()
          WHERE id = $2`,
        [engagementScore, userId]
      );

      await client.query("COMMIT");

      // Track progress events
      const trackPromises = [];
      if (completionPercent >= 100) {
        trackPromises.push(trackAction(userId, "complete", { postId, watchTime, videoDuration: actualDuration, completionPercent }));
      } else if (completionPercent >= 75) {
        trackPromises.push(trackAction(userId, "progress_75", { postId, watchTime, videoDuration: actualDuration, completionPercent }));
      } else if (completionPercent >= 50) {
        trackPromises.push(trackAction(userId, "progress_50", { postId, watchTime, videoDuration: actualDuration, completionPercent }));
      } else if (completionPercent >= 25) {
        trackPromises.push(trackAction(userId, "progress_25", { postId, watchTime, videoDuration: actualDuration, completionPercent }));
      } else {
        trackPromises.push(trackAction(userId, "watch_start", { postId, watchTime, videoDuration: actualDuration, completionPercent }));
      }

      for (const event of progressEvents) {
        if (event.type === "skip") {
          trackPromises.push(trackAction(userId, "skip", { postId, watchTime: event.watchTime || 0, videoDuration: actualDuration, completionPercent: event.completionPercent || 0 }));
        }
      }
      await Promise.all(trackPromises);

      const responsePayload = {
        success: true,
        completion: `${completionPercent.toFixed(1)}%`
      };
      
      if (generatedToken) {
        responsePayload.session_token = generatedToken;
      }

      return res.json(responsePayload);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {}
      console.error("Watch tracking error:", err.code, err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/watch/batch - NEW!
   */
  router.post("/batch", authMiddleware, async (req, res) => {
    const client = await pool.connect();
    // In batch processing, we also mandate cryptographic token verification for EACH session event.
    try {
      const userId = req.auth.userId;
      const { sessions } = req.body;

      if (!Array.isArray(sessions) || sessions.length === 0) {
        return res.status(400).json({ success: false, error: "sessions array required" });
      }

      const allowed = await checkProgressiveRateLimit(userId, "watch_batch", 60000, MAX_TRACK_REQUESTS_PER_MINUTE);
      if (!allowed) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
      }

      await client.query("BEGIN");
      const results = [];

      for (const session of sessions) {
        const postId = session.post_id;
        const requestedWatchTime = toNumber(session.watch_time);
        const isRespected = toBoolean(session.is_respected);
        const isSaved = toBoolean(session.is_saved);
        const sessionToken = session.session_token;

        if (!postId) {
          results.push({ post_id: postId, success: false, error: "Invalid post_id" });
          continue;
        }

        const isStart = requestedWatchTime === 0 && !sessionToken;
        let generatedToken = null;

        try {
          const postCheck = await client.query(`SELECT id, duration FROM posts WHERE id = $1 AND is_deleted = false FOR UPDATE`, [postId]);
          if (postCheck.rows.length === 0) {
            results.push({ post_id: postId, success: false, error: "Post not found" });
            continue;
          }

          const actualDuration = postCheck.rows[0].duration > 0 ? postCheck.rows[0].duration : 15;

          if (isStart) {
            const payload = { userId, postId, duration: actualDuration, sid: require('crypto').randomUUID() };
            generatedToken = jwt.sign(payload, WATCH_SECRET, { expiresIn: '1h', issuer: 'drandee-watch-sec' });
          } else {
            if (!sessionToken) {
              results.push({ post_id: postId, success: false, error: "Missing watch session token" });
              continue;
            }
            try {
              const decoded = jwt.verify(sessionToken, WATCH_SECRET, { issuer: 'drandee-watch-sec' });
              if (decoded.userId !== userId || decoded.postId !== postId || decoded.duration !== actualDuration) {
                 throw new Error("Session mismatch");
              }
              const sessionLifetime = (Date.now() - (decoded.iat * 1000)) / 1000;
              const maxWatchTime = sessionLifetime * 1000 + 5000;
              if (requestedWatchTime > maxWatchTime && requestedWatchTime > 10000) {
                 throw new Error("Impossible watch time");
              }
            } catch (err) {
              const { recordSecurityAnomaly } = require("../utils/antiBot");
              await recordSecurityAnomaly(userId, "forged_watch_session");
              results.push({ post_id: postId, success: false, error: "Invalid or expired watch session" });
              continue;
            }
          }

          const watchTime = Math.min(Math.max(requestedWatchTime, 0), actualDuration);
          const completionPercent = Math.min(Math.max((watchTime / actualDuration) * 100, 0), 100);

          await client.query(
            `INSERT INTO watch_sessions (user_id, post_id, watch_time, video_duration, completion_percent, is_respected, is_saved, last_watched_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id, post_id) DO UPDATE SET
              watch_time = GREATEST(watch_sessions.watch_time, EXCLUDED.watch_time),
              completion_percent = GREATEST(watch_sessions.completion_percent, EXCLUDED.completion_percent),
              is_respected = watch_sessions.is_respected OR EXCLUDED.is_respected,
              is_saved = watch_sessions.is_saved OR EXCLUDED.is_saved,
              last_watched_at = NOW()`,
            [userId, postId, watchTime, actualDuration, completionPercent, isRespected, isSaved]
          );

          await trackAction(userId, "complete", { postId, watchTime, videoDuration: actualDuration, completionPercent });

          const resPayload = { post_id: postId, success: true, completion: completionPercent.toFixed(1) };
          if (generatedToken) resPayload.session_token = generatedToken;
          results.push(resPayload);
        } catch (err) {
          results.push({ post_id: postId, success: false, error: "Processing error" });
        }
      }

      await client.query("COMMIT");
      return res.json({ success: true, count: results.length, results });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      console.error("Batch watch error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/watch/velocity
   * DEPRECATED: Internal intelligence signals are not exposed to the client.
   */
  router.get("/velocity", authMiddleware, async (req, res) => {
    return res.json({
      success: true,
      message: "Velocity tracking is handled server-side."
    });
  });

  return router;
};