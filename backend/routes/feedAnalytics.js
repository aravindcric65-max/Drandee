const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  getOrCreateExperiment,
  reassignVariant,
  recordFeedImpressions,
  recordFeedOutcome,
  getFeedExposureMetrics,
  getMetricsWithComparison,
  calculateSignificance,
  calculateCombinedScore,
} = require("../models/feedAnalyticsModel");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/
const MIN_IMPRESSIONS = 100;
const MIN_USERS = 10;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/
const toNumber = (value, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const toPositiveInteger = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const result = Number(String(value).trim());
  if (!Number.isSafeInteger(result) || result <= 0) {
    return null;
  }
  return result;
};

const toBooleanOrNull = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }
  return null;
};

const getInput = (req) => {
  const query = req.query && typeof req.query === "object" ? req.query : {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  return { ...query, ...body };
};

const getCompletionEvent = (completionPercent) => {
  if (completionPercent >= 100) {
    return "complete";
  }
  if (completionPercent >= 75) {
    return "progress_75";
  }
  if (completionPercent >= 50) {
    return "progress_50";
  }
  if (completionPercent >= 25) {
    return "progress_25";
  }
  return "watch_start";
};

const safeTrackAction = async (userId, actionType, metadata) => {
  try {
    const { trackAction } = require("../utils/engagementVelocity");
    const result = await trackAction(userId, actionType, metadata);
    return result === true;
  } catch (error) {
    console.error(`Redis action failed: ${actionType}`, error.message);
    return false;
  }
};

const hasEnoughData = (row) => {
  if (!row) {
    return false;
  }
  return (
    toNumber(row.impressions, 0) >= MIN_IMPRESSIONS &&
    toNumber(row.unique_users, 0) >= MIN_USERS
  );
};

/*
|--------------------------------------------------------------------------
| POST /api/feed-analytics/outcome
|--------------------------------------------------------------------------
*/
router.post("/outcome", authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get("db");
    const userId = req.auth.userId;
    const input = getInput(req);

    const postId = toPositiveInteger(input.post_id ?? input.postId);
    const creatorId = input.creator_id ?? input.creatorId ?? null;
    const category = String(input.category || "").trim().toLowerCase().slice(0, 80);

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: "Database connection not found",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authenticated user not found",
      });
    }

    if (!postId) {
      return res.status(400).json({
        success: false,
        error: "Valid post_id is required",
      });
    }

    const completionPercent = Math.min(
      Math.max(toNumber(input.completion_percent ?? input.completionPercent, 0), 0),
      100
    );

    const watchTime = Math.max(toNumber(input.watch_time ?? input.watchTime, 0), 0);

    const watched = toBooleanOrNull(input.watched);
    const skipped = toBooleanOrNull(input.skipped);
    const respected = toBooleanOrNull(input.respected) === true;
    const shared = toBooleanOrNull(input.shared) === true;
    const commented = toBooleanOrNull(input.commented) === true;

    const { calculateVariant } = require("../utils/feedExperiment");
    const variant = calculateVariant(userId);

    const queue = getAnalyticsQueue();
    const outcomeData = {
      userId,
      postId,
      watched,
      skipped,
      completionPercent,
      watchTime,
      respected,
      shared,
      commented,
      variant
    };

    await queue.add('feed_outcome', {
      userId,
      eventType: 'feed_outcome',
      data: outcomeData,
      timestamp: new Date().toISOString()
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 1000,
      jobId: `feed_outcome_${userId}_${postId}_${Date.now()}`
    });
    
    await connection.quit();

    const updated = true; // Assume true since it's queued

    const metadata = {
      postId,
      creatorId,
      category,
      watchTime,
      completionPercent,
    };

    const realtimeEvents = [];

    if (skipped === true) {
      const redisUpdated = await safeTrackAction(userId, "skip", metadata);
      realtimeEvents.push({ event: "skip", updated: redisUpdated });
    } else if (watched === true) {
      const eventType = getCompletionEvent(completionPercent);
      const redisUpdated = await safeTrackAction(userId, eventType, metadata);
      realtimeEvents.push({ event: eventType, updated: redisUpdated });
    }

    if (respected) {
      const redisUpdated = await safeTrackAction(userId, "respect", metadata);
      realtimeEvents.push({ event: "respect", updated: redisUpdated });
    }

    if (shared) {
      const redisUpdated = await safeTrackAction(userId, "share", metadata);
      realtimeEvents.push({ event: "share", updated: redisUpdated });
    }

    if (commented) {
      const redisUpdated = await safeTrackAction(userId, "comment", metadata);
      realtimeEvents.push({ event: "comment", updated: redisUpdated });
    }

    const redisUpdated =
      realtimeEvents.length === 0 ||
      realtimeEvents.every((item) => item.updated === true);

    return res.status(200).json({
      success: true,
      updated,
      realtimeSignal: {
        redisUpdated,
        event: realtimeEvents[0]?.event || null,
        events: realtimeEvents,
      },
      outcome: {
        userId,
        postId,
        watched,
        skipped,
        completionPercent,
        watchTime,
        respected,
        shared,
        commented,
      },
    });
  } catch (error) {
    console.error("Feed outcome error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to record feed outcome",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/feed-analytics/variant - NEW!
|--------------------------------------------------------------------------
*/
router.get("/variant", authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get("db");
    const userId = req.auth.userId;

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: "Database connection not found",
      });
    }

    const experiment = await getOrCreateExperiment(pool, userId);

    return res.json({
      success: true,
      variant: experiment.variant,
      userId,
    });
  } catch (error) {
    console.error("Get variant error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get variant",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/feed-analytics/variant - NEW! (Admin only)
|--------------------------------------------------------------------------
*/
router.post("/variant", authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get("db");
    const { userId, variant } = req.body;

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: "Database connection not found",
      });
    }

    if (req.auth.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    if (!userId || !variant) {
      return res.status(400).json({
        success: false,
        error: "userId and variant required",
      });
    }

    const result = await reassignVariant(pool, userId, variant);

    return res.json({
      success: true,
      variant: result.variant,
      userId: result.user_id,
    });
  } catch (error) {
    console.error("Reassign variant error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reassign variant",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/feed-analytics/metrics - NEW!
|--------------------------------------------------------------------------
*/
router.get("/metrics", authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get("db");
    const period = req.query.period || "all";

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: "Database connection not found",
      });
    }

    const result = await getMetricsWithComparison(pool, period);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get metrics error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get metrics",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/feed-analytics/export - NEW!
|--------------------------------------------------------------------------
*/
router.get("/export", authMiddleware, async (req, res) => {
  try {
    const pool = req.app.get("db");
    const period = req.query.period || "7d";
    const format = req.query.format || "json";

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: "Database connection not found",
      });
    }

    if (req.auth.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const metrics = await getFeedExposureMetrics(pool, period);

    if (format === "csv") {
      const csv = [
        ["variant", "impressions", "unique_users", "watched_count", "average_watch_time", "watch_rate_percent"],
        ...metrics.map(m => [
          m.variant,
          m.impressions,
          m.unique_users,
          m.watched_count,
          m.average_watch_time,
          m.watch_rate_percent,
        ]),
      ]
        .map(row => row.join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=feed-metrics-${period}.csv`);
      return res.send(csv);
    }

    return res.json({
      success: true,
      metrics,
      period,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Export metrics error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to export metrics",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Metrics handler (legacy)
|--------------------------------------------------------------------------
*/
const getMetrics = async (req, res) => {
  try {
    const pool = req.app.get("db");
    const period = req.query.period || "all";

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: "Database connection not found",
      });
    }

    if (req.auth.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const result = await getMetricsWithComparison(pool, period);

    const level6 = result.comparison.level6 || null;
    const control = result.comparison.control || null;
    const level6Ready = hasEnoughData(level6);
    const controlReady = hasEnoughData(control);

    let winner = null;
    let analysisStatus = "insufficient_data";

    if (level6Ready && controlReady) {
      winner = result.comparison.winner;
      analysisStatus = "ready";
    }

    return res.status(200).json({
      success: true,
      metrics: result.metrics,
      comparison: {
        level6,
        control,
        winner,
        winnerMetric: "combined_score",
        analysisStatus,
        minimumRequired: {
          impressions: MIN_IMPRESSIONS,
          users: MIN_USERS,
        },
        readiness: {
          level6: {
            ready: level6Ready,
            impressions: level6 ? toNumber(level6.impressions, 0) : 0,
            users: level6 ? toNumber(level6.unique_users, 0) : 0,
          },
          control: {
            ready: controlReady,
            impressions: control ? toNumber(control.impressions, 0) : 0,
            users: control ? toNumber(control.unique_users, 0) : 0,
          },
        },
        significance: result.comparison.significance,
        combinedScores: {
          level6: result.comparison.level6Score,
          control: result.comparison.controlScore,
        },
      },
      period,
    });
  } catch (error) {
    console.error("Feed metrics error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to load feed metrics",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Metrics routes
|--------------------------------------------------------------------------
*/
router.get("/exposure", authMiddleware, getMetrics);
router.get("/summary", authMiddleware, getMetrics);

module.exports = router;