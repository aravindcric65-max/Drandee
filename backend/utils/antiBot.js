const Redis = require("ioredis");

let redisClient = null;
const redisEnabled = process.env.REDIS_ENABLED === "true" || process.env.REDIS_URL;

if (redisEnabled) {
  redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
}

/**
 * Checks progressive rate limits for abuse mitigation.
 * @param {string} userId - The user ID to check
 * @param {string} action - The action namespace (e.g., 'watch', 'respect')
 * @param {number} windowMs - Time window for standard rate limit in ms
 * @param {number} maxRequests - Max requests allowed in the standard window
 * @returns {Promise<boolean>} - true if allowed, false if rate limited or restricted
 */
async function checkProgressiveRateLimit(userId, action, windowMs = 60000, maxRequests = 60) {
  if (!redisClient) return true; // Fail open if no redis

  try {
    const baseKey = `antibot:rl:${action}:${userId}`;
    const strikeKey = `antibot:strikes:${userId}`;
    const penaltyKey = `antibot:penalty:${userId}`;

    // 1. Check if user is currently under a penalty
    const isPenalized = await redisClient.get(penaltyKey);
    if (isPenalized) {
      return false; // User is in a penalty box
    }

    // 2. Process the base rate limit
    const current = await redisClient.incr(baseKey);
    if (current === 1) {
      await redisClient.pexpire(baseKey, windowMs);
    }

    if (current <= maxRequests) {
      return true; // Allowed
    }

    // 3. User exceeded rate limit. Issue a strike.
    const strikes = await redisClient.incr(strikeKey);
    if (strikes === 1) {
      await redisClient.expire(strikeKey, 3600); // Strikes decay after 1 hour
    }

    // 4. Progressive escalation based on strikes
    if (strikes >= 5) {
      // Repeated abuse -> 24-hour restriction
      await redisClient.set(penaltyKey, "restricted", "EX", 86400);
    } else if (strikes >= 3) {
      // 3 violations -> 5-minute cooldown
      await redisClient.set(penaltyKey, "cooldown", "EX", 300);
    }

    return false; // Rate limited
  } catch (error) {
    console.error("Progressive anti-bot error:", error.message);
    return true; // Fail open
  }
}

/**
 * Helper for simple cooldowns (e.g. 1 toggle per 5 seconds per post)
 */
async function checkCooldown(key, ttlSeconds = 5) {
  if (!redisClient) return true;
  try {
    const result = await redisClient.set(key, "1", "NX", "EX", ttlSeconds);
    return result === "OK";
  } catch (error) {
    console.error("Cooldown error:", error.message);
    return true;
  }
}

/**
 * Records a security anomaly (e.g., failed login burst, provider abuse)
 * Applies a graduated temporary security lock.
 */
async function recordSecurityAnomaly(userId, anomalyType) {
  if (!redisClient) return;
  try {
    const anomalyKey = `antibot:anomaly:${userId}`;
    const lockKey = `antibot:security_lock:${userId}`;

    const count = await redisClient.incr(anomalyKey);
    if (count === 1) {
      await redisClient.expire(anomalyKey, 3600); // 1 hour window
    }

    if (count >= 10) {
      // 10 anomalies -> 24 hour lock on sensitive actions
      await redisClient.set(lockKey, "1", "EX", 86400);
    } else if (count >= 5) {
      // 5 anomalies -> 1 hour lock
      await redisClient.set(lockKey, "1", "EX", 3600);
    } else if (count >= 3) {
      // 3 anomalies -> 5 min lock
      await redisClient.set(lockKey, "1", "EX", 300);
    }
  } catch (error) {
    console.error("Security anomaly tracking error:", error.message);
  }
}

/**
 * Checks if a user is currently under a security lock for sensitive actions
 */
async function checkSecurityLock(userId) {
  if (!redisClient) return false;
  try {
    const lockKey = `antibot:security_lock:${userId}`;
    const isLocked = await redisClient.get(lockKey);
    return !!isLocked;
  } catch (error) {
    console.error("Security lock check error:", error.message);
    return false; // Fail open
  }
}

module.exports = {
  checkProgressiveRateLimit,
  checkCooldown,
  recordSecurityAnomaly,
  checkSecurityLock,
  redisClient
};
