const express = require("express");
const authMiddleware = require('../middleware/auth');

let analyticsQueue = null;
function getAnalyticsQueue() {
  if (!analyticsQueue) {
    const { Queue } = require('bullmq');
    const IORedis = require('ioredis');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    analyticsQueue = new Queue('Analytics', { connection });
  }
  return analyticsQueue;
}

const { trackAction, getVelocity } = require("../utils/engagementVelocity");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_EVENTS_PER_MINUTE: 100,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId, eventCount = 1) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length + eventCount > rateLimits.MAX_EVENTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const toNumber = (value, fallback = 0) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  };

  const toBoolean = (value) => {
    return value === true || value === "true";
  };

  const toPositiveInteger = (value, fallback = 0) => {
    const result = parseInt(value, 10);
    return Number.isInteger(result) && result >= 0 ? result : fallback;
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

  const validateEvent = (event) => {
    const errors = [];

    if (!event.event_type) {
      errors.push("event_type required");
    }

    if (!event.post_id) {
      errors.push("post_id required");
    }

    if (event.watch_time && toNumber(event.watch_time) < 0) {
      errors.push("watch_time must be >= 0");
    }

    if (event.video_duration && toNumber(event.video_duration) <= 0) {
      errors.push("video_duration must be > 0");
    }

    if (event.completion_percent && (toNumber(event.completion_percent) < 0 || toNumber(event.completion_percent) > 100)) {
      errors.push("completion_percent must be 0–100");
    }

    return errors;
  };

  /*
   * POST /api/events
   */
  router.post("/", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const events = Array.isArray(req.body.events) ? req.body.events : [req.body];

      // Rate limit check - NEW!
      if (!checkRateLimit(userId, events.length)) {
        return res.status(429).json({
          success: false,
          error: "Too many events. Please slow down.",
        });
      }

      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one event required",
        });
      }

      const results = [];
      const validEvents = [];

      // Validate and dedupe - NEW!
      const seenEvents = new Set();

      for (const event of events) {
        const errors = validateEvent(event);

        if (errors.length > 0) {
          results.push({
            event_type: event.event_type || "unknown",
            success: false,
            errors,
          });
          continue;
        }

        // Deduplication - NEW!
        const eventKey = `${event.event_type}:${event.post_id}:${event.watch_time || 0}`;
        if (seenEvents.has(eventKey)) {
          results.push({
            event_type: event.event_type,
            success: false,
            error: "Duplicate event",
          });
          continue;
        }
        seenEvents.add(eventKey);

        validEvents.push(event);
      }

      if (validEvents.length === 0) {
        return res.json({
          success: true,
          count: 0,
          results,
        });
      }

      await client.query("BEGIN");

      for (const event of validEvents) {
        const postId = event.post_id;
        const videoDuration = toNumber(event.video_duration);
        const watchTime = toNumber(event.watch_time);
        const isRespected = toBoolean(event.is_respected);
        const isSaved = toBoolean(event.is_saved);
        const completionPercent = videoDuration > 0
          ? Math.min((watchTime / videoDuration) * 100, 100)
          : toNumber(event.completion_percent, 0);

        try {
          const { calculateVariant } = require("../utils/feedExperiment");
          const variant = calculateVariant(userId);

          const queue = getAnalyticsQueue();

          await queue.add('watch_event', {
            userId,
            eventType: event.event_type,
            data: {
              postId,
              watchTime,
              videoDuration,
              completionPercent,
              isRespected,
              isSaved,
              variant
            },
            timestamp: new Date().toISOString()
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 1000,
            jobId: `watch_${userId}_${postId}_${Date.now()}`
          });


          // For realtime tracking (keep velocity accurate immediately)
          if (isRespected) await trackAction(userId, 'respect', { postId });
          if (isSaved) await trackAction(userId, 'save', { postId });
          if (watchTime > 5000) await trackAction(userId, 'watch', { postId });

          results.push({
            event_type: event.event_type,
            post_id: postId,
            success: true
          });
        } catch (err) {
          results.push({
            event_type: event.event_type,
            post_id: event.post_id,
            success: false,
            error: err.message,
          });
        }
      }

      await client.query("COMMIT");

      const velocity = await getVelocity(userId);

      return res.json({
        success: true,
        count: results.length,
        results,
        velocity,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Events rollback error:", rollbackError.message);
      }
      console.error("Events error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/events/batch - NEW!
   */
  router.post("/batch", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { events } = req.body;

      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          success: false,
          error: "events array required",
        });
      }

      // Rate limit check - NEW!
      if (!checkRateLimit(userId, events.length)) {
        return res.status(429).json({
          success: false,
          error: "Too many events. Please slow down.",
        });
      }

      const results = [];
      const validEvents = [];
      const seenEvents = new Set();

      // Validate and dedupe - NEW!
      for (const event of events) {
        const errors = validateEvent(event);

        if (errors.length > 0) {
          results.push({
            event_type: event.event_type || "unknown",
            success: false,
            errors,
          });
          continue;
        }

        // Deduplication - NEW!
        const eventKey = `${event.event_type}:${event.post_id}:${event.watch_time || 0}`;
        if (seenEvents.has(eventKey)) {
          results.push({
            event_type: event.event_type,
            success: false,
            error: "Duplicate event",
          });
          continue;
        }
        seenEvents.add(eventKey);

        validEvents.push(event);
      }

      if (validEvents.length === 0) {
        return res.json({
          success: true,
          count: 0,
          results,
        });
      }

      await client.query("BEGIN");

      for (const event of validEvents) {
        const postId = event.post_id;
        const videoDuration = toNumber(event.video_duration);
        const watchTime = toNumber(event.watch_time);
        const isRespected = toBoolean(event.is_respected);
        const isSaved = toBoolean(event.is_saved);
        const completionPercent = videoDuration > 0
          ? Math.min((watchTime / videoDuration) * 100, 100)
          : toNumber(event.completion_percent, 0);

        try {
          const { calculateVariant } = require("../utils/feedExperiment");
          const variant = calculateVariant(userId);

          const queue = getAnalyticsQueue();

          await queue.add('watch_event', {
            userId,
            eventType: event.event_type,
            data: {
              postId,
              watchTime,
              videoDuration,
              completionPercent,
              isRespected,
              isSaved,
              variant
            },
            timestamp: new Date().toISOString()
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 1000,
            jobId: `watch_batch_${userId}_${postId}_${Date.now()}`
          });
          

          await trackAction(userId, event.event_type, {
            postId,
            watchTime,
            videoDuration,
            completionPercent,
          });

          results.push({
            event_type: event.event_type,
            post_id: postId,
            success: true,
            completion: completionPercent.toFixed(1),
          });
        } catch (err) {
          results.push({
            event_type: event.event_type,
            post_id: event.post_id,
            success: false,
            error: err.message,
          });
        }
      }

      await client.query("COMMIT");

      const velocity = await getVelocity(userId);

      return res.json({
        success: true,
        count: results.length,
        results,
        velocity,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Batch events rollback error:", rollbackError.message);
      }
      console.error("Batch events error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/events/velocity
   */
  /*
 * GET /api/events/velocity
 */
  router.get("/velocity", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const velocity = await getVelocity(userId);

      return res.json({
        success: true,
        velocity,
      });
    } catch (err) {
      console.error("Get velocity error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * GET /api/upload/progress - SSE endpoint
   */
  router.get("/upload/progress", authMiddleware, async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const userId = req.auth.userId;
    const jobId = req.query.jobId;

    if (!jobId) {
      res.write('event: error\ndata: {"error":"jobId required"}\n\n');
      return res.end();
    }

    const interval = setInterval(async () => {
      try {
        const result = await pool.query(
          "SELECT status, progress, stage, error_message FROM upload_jobs WHERE id = $1 AND user_id = $2",
          [jobId, userId]
        );

        if (result.rows.length > 0) {
          const job = result.rows[0];
          res.write(`data: ${JSON.stringify(job)}\n\n`);

          if (job.status === "completed" || job.status === "failed") {
            clearInterval(interval);
            res.end();
          }
        }
      } catch (error) {
        console.error("SSE Error:", error);
      }
    }, 1000);

    req.on("close", () => {
      clearInterval(interval);
    });
  });

  return router;
};
