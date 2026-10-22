const crypto = require("crypto");

// ============================================
// Redis Configuration (Optional)
// ============================================

const redisEnabled = process.env.REDIS_ENABLED === "true";
let redisClient = null;
let redisConnected = false;
let redisConnecting = null;

// Mock Redis client if Redis is disabled
const mockRedis = {
  connect: () => Promise.resolve(),
  quit: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  set: () => Promise.resolve("OK"),
  get: () => Promise.resolve(null),
  del: () => Promise.resolve(1),
  incr: () => Promise.resolve(1),
  expire: () => Promise.resolve(1),
  hSet: () => Promise.resolve(1),
  hGetAll: () => Promise.resolve({}),
  hIncrByFloat: () => Promise.resolve(1),
  zAdd: () => Promise.resolve(1),
  zRangeByScore: () => Promise.resolve([]),
  zRemRangeByScore: () => Promise.resolve(1),
  multi: () => ({
    zAdd: () => ({ multi: () => ({ multi: () => ({}) }) }),
    zRemRangeByScore: () => ({ multi: () => ({ multi: () => ({}) }) }),
    expire: () => ({ multi: () => ({ multi: () => ({}) }) }),
    hSet: () => ({ multi: () => ({ multi: () => ({}) }) }),
    hIncrByFloat: () => ({ multi: () => ({ multi: () => ({}) }) }),
    exec: () => Promise.resolve([]),
  }),
  on: () => {},
  isOpen: false,
  isReady: false,
};

// ============================================
// Configuration
// ============================================

const WINDOW_MS = 15 * 60 * 1000;
const WINDOW_SECONDS = 15 * 60;
const PROFILE_TTL_SECONDS = 24 * 60 * 60;

const ACTION_WEIGHTS = {
  watch_start: 1,
  progress_25: 1,
  progress_50: 1.2,
  progress_75: 1.5,
  complete: 2,
  skip: -0.5,
  respect: 1.5,
  save: 2,
  share: 3,
  comment: 2.5,
  follow: 2,
  not_interested: -3,
  report: -5,
};

const WATCH_EVENTS = new Set([
  "watch_start",
  "progress_25",
  "progress_50",
  "progress_75",
  "complete",
]);

const RATE_LIMITS = {
  MAX_ACTIONS_PER_MINUTE: 100,
  MAX_ACTIONS_PER_HOUR: 1000,
};

const fallbackQueue = [];

// ============================================
// Connection
// ============================================

async function ensureRedis() {
  if (!redisEnabled) {
    redisClient = mockRedis;
    return mockRedis;
  }

  if (redisConnected && redisClient?.isReady) {
    return redisClient;
  }

  if (redisConnecting) {
    return redisConnecting;
  }

  redisConnecting = (async () => {
    try {
      const { createClient } = require("redis");
      
      redisClient = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      redisClient.on("error", (error) => {
        console.error("Redis error:", error.message);
        redisConnected = false;
      });

      redisClient.on("connect", () => {
        console.log("Redis socket connected");
      });

      redisClient.on("ready", () => {
        console.log("Redis ready");
        redisConnected = true;
      });

      redisClient.on("end", () => {
        console.log("Redis connection closed");
        redisConnected = false;
      });

      if (!redisClient.isOpen) {
        await redisClient.connect();
      }

      redisConnected = true;
      return redisClient;
    } catch (error) {
      redisConnected = false;
      console.warn("⚠️  Redis not available. Running without Redis.");
      redisClient = mockRedis;
      return mockRedis;
    } finally {
      redisConnecting = null;
    }
  })();

  return redisConnecting;
}

// ============================================
// Keys
// ============================================

function getEventKey(userId) {
  return `engagement:user:${userId}:events`;
}

function getProfileKey(userId) {
  return `engagement:user:${userId}:profile`;
}

function getDedupeKey(userId, postId, actionType) {
  return ["engagement", "dedupe", userId, postId || "none", actionType].join(":");
}

function getPostSignalKey(postId) {
  return `engagement:post:${postId}`;
}

function getCreatorSignalKey(creatorId) {
  return `engagement:creator:${creatorId}`;
}

function getCategorySignalKey(category) {
  return `engagement:category:${category}`;
}

function getRateLimitKey(userId, window) {
  return `rate:user:${userId}:${window}`;
}

// ============================================
// Helpers
// ============================================

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function cleanString(value) {
  return String(value || "").trim();
}

function cleanAction(value) {
  return cleanString(value).toLowerCase();
}

function cleanCategory(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function intensityFromScore(score) {
  if (score >= 8) return "very_high";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function emptyVelocity() {
  return {
    score: 0,
    velocity1m: 0,
    velocity5m: 0,
    velocity15m: 0,
    intensity: "low",
    watchVelocity: 0,
    interactionVelocity: 0,
    skipRate: 0,
    eventsCount: 0,
    isHighlyEngaged: false,
    isAtRiskChurn: false,
  };
}

// ============================================
// Rate Limiting
// ============================================

async function checkRateLimit(userId, window = "minute") {
  if (!redisEnabled) return true;

  try {
    const client = await ensureRedis();
    const key = getRateLimitKey(userId, window);
    const limit = window === "minute" ? RATE_LIMITS.MAX_ACTIONS_PER_MINUTE : RATE_LIMITS.MAX_ACTIONS_PER_HOUR;
    const ttl = window === "minute" ? 60 : 3600;

    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, ttl);
    }

    return count <= limit;
  } catch (error) {
    console.error("Rate limit check error:", error.message);
    return true;
  }
}

// ============================================
// Fallback Queue Processing
// ============================================

async function processFallbackQueue() {
  if (fallbackQueue.length === 0 || !redisConnected || !redisEnabled) {
    return;
  }

  const batch = fallbackQueue.splice(0, 50);
  const client = await ensureRedis();
  const multi = client.multi();

  for (const item of batch) {
    const { userId, actionType, metadata } = item;
    const eventKey = getEventKey(userId);
    const profileKey = getProfileKey(userId);
    const timestamp = item.timestamp || Date.now();

    const event = {
      id: crypto.randomUUID(),
      userId: cleanString(userId),
      actionType: cleanAction(actionType),
      weight: ACTION_WEIGHTS[cleanAction(actionType)] || 1,
      postId: metadata.postId ? String(metadata.postId) : null,
      creatorId: metadata.creatorId ? String(metadata.creatorId) : null,
      category: cleanCategory(metadata.category),
      watchTime: Math.max(number(metadata.watchTime, 0), 0),
      videoDuration: Math.max(number(metadata.videoDuration, 0), 0),
      completionPercent: Math.min(Math.max(number(metadata.completionPercent, 0), 0), 100),
      timestamp,
    };

    const member = JSON.stringify(event);
    multi.zAdd(eventKey, { score: timestamp, value: member });
    multi.zRemRangeByScore(eventKey, 0, timestamp - WINDOW_MS);
    multi.expire(eventKey, WINDOW_SECONDS + 30);

    if (event.postId) {
      multi.hIncrByFloat(profileKey, `post:${event.postId}`, event.weight);
    }

    multi.hIncrByFloat(profileKey, `action:${event.actionType}`, event.weight);
    multi.expire(profileKey, PROFILE_TTL_SECONDS);
  }

  try {
    if (redisEnabled && !redisClient.isReady) {
      throw new Error("Redis is not ready, failing fast");
    }
    const execPromise = multi.exec();
    const results = await Promise.race([
      execPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis exec timeout")), 3000))
    ]);
    
    // Check if any command in the transaction failed (for both redis/ioredis formats)
    if (results && Array.isArray(results)) {
      for (const res of results) {
        if (res instanceof Error || (Array.isArray(res) && res[0] instanceof Error)) {
          throw new Error("Redis transaction failed: " + (res.message || (res[0] && res[0].message)));
        }
      }
    }
    console.log(`Processed ${batch.length} fallback events`);
  } catch (error) {
    console.error("Fallback queue processing error:", error.message);
    fallbackQueue.unshift(...batch);
  }
}

setInterval(processFallbackQueue, 10000);

// ============================================
// Track Action
// ============================================

async function trackAction(userId, actionType, metadata = {}) {
  if (!redisEnabled) return true;

  const normalizedUserId = cleanString(userId);
  const normalizedAction = cleanAction(actionType);
  const weight = ACTION_WEIGHTS[normalizedAction];

  if (!normalizedUserId || typeof weight !== "number") {
    return false;
  }

  const rateLimitOk = await checkRateLimit(normalizedUserId, "minute");
  if (!rateLimitOk) {
    console.warn(`Rate limit exceeded for user ${normalizedUserId}`);
    return false;
  }

  const postId = metadata.postId === null || metadata.postId === undefined ? null : String(metadata.postId);
  const creatorId = metadata.creatorId === null || metadata.creatorId === undefined ? null : String(metadata.creatorId);
  const category = cleanCategory(metadata.category);
  const watchTime = Math.max(number(metadata.watchTime, 0), 0);
  const videoDuration = Math.max(number(metadata.videoDuration, 0), 0);
  const completionPercent = Math.min(Math.max(number(metadata.completionPercent, 0), 0), 100);

  const isWatchEvent = postId && WATCH_EVENTS.has(normalizedAction);

  try {
    const client = await ensureRedis();
    let isDuplicate = false;

    if (isWatchEvent) {
      const dedupeKey = getDedupeKey(normalizedUserId, postId, normalizedAction);
      const dedupeResult = await client.set(dedupeKey, "1", {
        NX: true,
        EX: WINDOW_SECONDS,
      });
      if (dedupeResult !== "OK") {
        isDuplicate = true;
      }
    }

    const timestamp = Date.now();
    const event = {
      id: crypto.randomUUID(),
      userId: normalizedUserId,
      actionType: normalizedAction,
      weight,
      postId,
      creatorId,
      category,
      watchTime,
      videoDuration,
      completionPercent,
      timestamp,
      experiment_id: metadata.experiment_id || null,
      variant_id: metadata.variant_id || null,
    };

    const eventKey = getEventKey(normalizedUserId);
    const profileKey = getProfileKey(normalizedUserId);
    const multi = client.multi();

    if (isWatchEvent) {
      multi.hSet(profileKey, `watched:${postId}`, "1");
    }

    if (!isDuplicate) {
      const member = JSON.stringify(event);
      multi.zAdd(eventKey, { score: timestamp, value: member });
      multi.zRemRangeByScore(eventKey, 0, timestamp - WINDOW_MS);
      multi.expire(eventKey, WINDOW_SECONDS + 30);
      multi.hIncrByFloat(profileKey, `action:${normalizedAction}`, weight);

      if (postId) {
        multi.hIncrByFloat(profileKey, `post:${postId}`, weight);
        const postKey = getPostSignalKey(postId);
        multi.hIncrByFloat(postKey, `action:${normalizedAction}`, 1);
        multi.hIncrByFloat(postKey, "completion", completionPercent);
        multi.hIncrByFloat(postKey, "watch_time", watchTime);
        multi.expire(postKey, PROFILE_TTL_SECONDS);
      }

      if (creatorId) {
        const creatorKey = getCreatorSignalKey(creatorId);
        multi.hIncrByFloat(creatorKey, `action:${normalizedAction}`, 1);
        multi.expire(creatorKey, PROFILE_TTL_SECONDS);
      }

      if (category) {
        const categoryKey = getCategorySignalKey(category);
        multi.hIncrByFloat(categoryKey, `action:${normalizedAction}`, 1);
        multi.expire(categoryKey, PROFILE_TTL_SECONDS);
      }
    }

    multi.expire(profileKey, PROFILE_TTL_SECONDS);
    if (redisEnabled && !redisClient.isReady) {
      throw new Error("Redis is not ready, failing fast");
    }
    const execPromise = multi.exec();
    const results = await Promise.race([
      execPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis exec timeout")), 3000))
    ]);
    
    if (results && Array.isArray(results)) {
      for (const res of results) {
        if (res instanceof Error || (Array.isArray(res) && res[0] instanceof Error)) {
          throw new Error("Redis transaction failed: " + (res.message || (res[0] && res[0].message)));
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Track engagement error:", error.message);

    fallbackQueue.push({
      userId: normalizedUserId,
      actionType: normalizedAction,
      metadata,
      timestamp: Date.now(),
    });

    return false;
  }
}

// ============================================
// Batch Track Actions
// ============================================

async function trackActions(userId, actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return 0;
  }

  let successCount = 0;

  for (const action of actions) {
    const { actionType, metadata } = action;
    const result = await trackAction(userId, actionType, metadata);
    if (result) {
      successCount++;
    }
  }

  return successCount;
}

// ============================================
// Get Velocity
// ============================================

async function getVelocity(userId) {
  if (!redisEnabled) return emptyVelocity();

  const normalizedUserId = cleanString(userId);
  if (!normalizedUserId) {
    return emptyVelocity();
  }

  try {
    const client = await ensureRedis();
    const now = Date.now();
    const eventKey = getEventKey(normalizedUserId);
    const rows = await client.zRangeByScore(eventKey, now - WINDOW_MS, now);

    const events = rows
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const lastMinute = events.filter((event) => now - event.timestamp <= 60 * 1000);
    const lastFiveMinutes = events.filter((event) => now - event.timestamp <= 5 * 60 * 1000);

    const score = (items) => {
      return items.reduce((total, item) => total + number(item.weight, 0), 0);
    };

    const score1m = score(lastMinute);
    const score5m = score(lastFiveMinutes) / 5;
    const score15m = score(events) / 15;
    const velocity = score1m * 0.6 + score5m * 0.3 + score15m * 0.1;

    const watches = events.filter((event) => event.actionType === "watch_start").length;
    const interactions = events.filter((event) =>
      ["respect", "save", "share", "comment", "follow"].includes(event.actionType)
    ).length;
    const skips = events.filter((event) => event.actionType === "skip").length;
    const skipRate = events.length > 0 ? skips / events.length : 0;

    return {
      score: Number(velocity.toFixed(2)),
      velocity1m: Number(score1m.toFixed(2)),
      velocity5m: Number(score5m.toFixed(2)),
      velocity15m: Number(score15m.toFixed(2)),
      intensity: intensityFromScore(velocity),
      watchVelocity: Number((watches / 15).toFixed(2)),
      interactionVelocity: Number((interactions / 15).toFixed(2)),
      skipRate: Number(skipRate.toFixed(3)),
      eventsCount: events.length,
      isHighlyEngaged: velocity >= 5 && interactions / 15 >= 0.5 && skipRate < 0.6,
      isAtRiskChurn: events.length >= 5 && velocity < 1 && skipRate >= 0.5,
    };
  } catch (error) {
    console.error("Get velocity error:", error.message);
    return emptyVelocity();
  }
}

// ============================================
// Get Realtime Profile
// ============================================

async function getRealtimeProfile(userId) {
  if (!redisEnabled) {
    return {
      actions: {},
      postScores: {},
      watchedPosts: [],
    };
  }

  const normalizedUserId = cleanString(userId);
  if (!normalizedUserId) {
    return {
      actions: {},
      postScores: {},
      watchedPosts: [],
    };
  }

  try {
    const client = await ensureRedis();
    const profileKey = getProfileKey(normalizedUserId);
    const profile = await client.hGetAll(profileKey);

    const actions = {};
    const postScores = {};
    const watchedPosts = [];

    for (const [field, value] of Object.entries(profile)) {
      const numericValue = number(value, 0);
      if (field.startsWith("action:")) {
        const action = field.replace("action:", "");
        actions[action] = numericValue;
      } else if (field.startsWith("post:")) {
        const postId = field.replace("post:", "");
        postScores[postId] = numericValue;
      } else if (field.startsWith("watched:")) {
        const postId = field.replace("watched:", "");
        watchedPosts.push(postId);
      }
    }

    return {
      actions,
      postScores,
      watchedPosts,
    };
  } catch (error) {
    console.error("Get realtime profile error:", error.message);
    return {
      actions: {},
      postScores: {},
      watchedPosts: [],
    };
  }
}

// ============================================
// Get Post Signal
// ============================================

async function getPostSignal(postId) {
  if (!redisEnabled || !postId) {
    return {};
  }

  try {
    const client = await ensureRedis();
    const result = await client.hGetAll(getPostSignalKey(postId));
    return Object.fromEntries(
      Object.entries(result).map(([key, value]) => [key, number(value, 0)])
    );
  } catch (error) {
    console.error("Get post signal error:", error.message);
    return {};
  }
}

// ============================================
// Feed Adjustment
// ============================================

function getFeedAdjustment(velocity, post) {
  const safeVelocity = {
    score: number(velocity?.score, 0),
    skipRate: number(velocity?.skipRate, 0),
    intensity: velocity?.intensity || "low",
  };

  let adjustment = 0;

  if (safeVelocity.score >= 5) {
    adjustment += 25;
  }
  if (safeVelocity.score >= 8) {
    adjustment += 35;
  }
  if (post?.isFollowingCreator) {
    adjustment += 80;
  }
  if (safeVelocity.skipRate >= 0.5) {
    adjustment -= 40;
  }
  if (number(post?.totalRespects, 0) < 1000 && number(post?.avgCompletionRate, 0) >= 60) {
    adjustment += 20;
  }

  return Math.round(adjustment);
}

// ============================================
// Close Redis
// ============================================

async function closeRedis() {
  try {
    if (redisEnabled && redisClient?.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error("Close Redis error:", error.message);
  } finally {
    redisConnected = false;
    redisConnecting = null;
  }
}

// ============================================
// Exports
// ============================================

module.exports = {
  ensureRedis,
  trackAction,
  trackActions,
  getVelocity,
  getRealtimeProfile,
  getPostSignal,
  getFeedAdjustment,
  closeRedis,
  checkRateLimit,
  processFallbackQueue,
  redisEnabled,
};