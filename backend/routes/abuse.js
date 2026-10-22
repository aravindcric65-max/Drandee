const requireRole = require("../middleware/role");
const express = require("express");
const authMiddleware = require("../middleware/auth");
const crypto = require("crypto");

module.exports = (pool, redisClient) => {
  const router = express.Router();

  // Rate limiting configuration
  const rateLimits = {
    MAX_REPORTS_PER_MINUTE: 5,
    MAX_CAPTCHA_ATTEMPTS: 3,
    BLOCK_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  };

  const userRequests = new Map();

  const checkRateLimit = (userId, limit = rateLimits.MAX_REPORTS_PER_MINUTE) => {
    const now = Date.now();
    const userReqs = userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= limit) {
      return false;
    }
    
    recentReqs.push(now);
    userRequests.set(userId, recentReqs);
    return true;
  };

  // Redis-backed rate limiting helper
  const checkRedisRateLimit = async (key, limit, windowMs) => {
    if (!redisClient) {
      return { allowed: true, remaining: limit };
    }

    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, Math.ceil(windowMs / 1000));
      }

      const ttl = await redisClient.ttl(key);
      return {
        allowed: current <= limit,
        remaining: Math.max(limit - current, 0),
        resetIn: ttl * 1000,
      };
    } catch (err) {
      console.error("Redis rate limit error:", err.message);
      return { allowed: true, remaining: limit };
    }
  };

  // Generate captcha
  const generateCaptcha = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let captcha = "";
    for (let i = 0; i < 6; i++) {
      captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return captcha;
  };

  // Hash captcha for storage
  const hashCaptcha = (captcha) => {
    return crypto
      .createHash("sha256")
      .update(captcha.toLowerCase())
      .digest("hex");
  };

  /*
   * POST /api/abuse/report - Report abusive content/user
   */
  router.post("/report", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { type, targetId, reason, description } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId, rateLimits.MAX_REPORTS_PER_MINUTE)) {
        return res.status(429).json({
          success: false,
          error: "Too many reports. Please slow down.",
        });
      }

      if (!type || !targetId || !reason) {
        return res.status(400).json({
          success: false,
          error: "type, targetId, and reason required",
        });
      }

      const validTypes = ["post", "comment", "user", "message"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid type",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO abuse_reports (
          reporter_id,
          type,
          target_id,
          reason,
          description,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        RETURNING id, reporter_id, type, target_id, reason, status, created_at`,
        [userId, type, targetId, reason, description || null]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        report: {
          id: result.rows[0].id,
          reporterId: result.rows[0].reporter_id,
          type: result.rows[0].type,
          targetId: result.rows[0].target_id,
          reason: result.rows[0].reason,
          status: result.rows[0].status,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Abuse report rollback error:", rollbackError.message);
      }
      console.error("Report abuse error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/abuse/status - Check user/IP abuse status
   */
  router.get("/status", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const ip = req.ip || req.connection.remoteAddress;

      const [userStatus, ipStatus] = await Promise.all([
        pool.query(
          `SELECT
            account_status = 'SUSPENDED',
            banned_at,
            ban_reason,
            ban_expires_at,
            spam_score
           FROM users
           WHERE id = $1`,
          [userId]
        ),
        pool.query(
          `SELECT
            is_blocked,
            blocked_at,
            block_reason,
            block_expires_at
           FROM blocked_ips
           WHERE ip = $1`,
          [ip]
        ),
      ]);

      const user = userStatus.rows[0];
      const ipBlock = ipStatus.rows[0];

      return res.json({
        success: true,
        status: {
          user: {
            isBanned: user?.account_status = 'SUSPENDED' || false,
            bannedAt: user?.banned_at,
            banReason: user?.ban_reason,
            banExpires: user?.ban_expires_at,
            spamScore: user?.spam_score || 0,
          },
          ip: {
            isBlocked: ipBlock?.is_blocked || false,
            blockedAt: ipBlock?.blocked_at,
            blockReason: ipBlock?.block_reason,
            blockExpires: ipBlock?.block_expires_at,
          },
        },
      });
    } catch (err) {
      console.error("Get abuse status error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/abuse/captcha - Verify captcha challenge
   */
  router.post("/captcha", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { captcha, challengeId } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId, rateLimits.MAX_CAPTCHA_ATTEMPTS)) {
        return res.status(429).json({
          success: false,
          error: "Too many attempts. Please try again later.",
        });
      }

      if (!captcha || !challengeId) {
        return res.status(400).json({
          success: false,
          error: "captcha and challengeId required",
        });
      }

      // Check Redis for challenge
      if (redisClient) {
        const storedHash = await redisClient.get(`captcha:${challengeId}`);
        
        if (!storedHash) {
          return res.status(400).json({
            success: false,
            error: "Challenge expired or invalid",
          });
        }

        const submittedHash = hashCaptcha(captcha);

        if (storedHash === submittedHash) {
          // Valid captcha
          await redisClient.del(`captcha:${challengeId}`);
          
          // Clear any rate limits for this user
          await redisClient.del(`rate_limit:${userId}`);

          return res.json({
            success: true,
            message: "Captcha verified",
          });
        } else {
          return res.status(400).json({
            success: false,
            error: "Invalid captcha",
          });
        }
      } else {
        // Fallback without Redis (always pass in dev)
        return res.json({
          success: true,
          message: "Captcha verified (dev mode)",
        });
      }
    } catch (err) {
      console.error("Verify captcha error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/abuse/captcha - Generate new captcha challenge
   */
  router.get("/captcha", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const captcha = generateCaptcha();
      const challengeId = crypto.randomBytes(16).toString("hex");

      if (redisClient) {
        const captchaHash = hashCaptcha(captcha);
        await redisClient.set(`captcha:${challengeId}`, captchaHash, { EX: 300 }); // 5 min

        return res.json({
          success: true,
          challengeId,
          captchaImage: `data:image/svg+xml;base64,${Buffer.from(captcha).toString("base64")}`,
          expires: 300,
        });
      } else {
        // Fallback without Redis
        return res.json({
          success: true,
          challengeId,
          captchaImage: `data:image/svg+xml;base64,${Buffer.from(captcha).toString("base64")}`,
          expires: 300,
          devMode: true,
        });
      }
    } catch (err) {
      console.error("Generate captcha error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/abuse/rate-limit - Check current rate limit status
   */
  router.get("/rate-limit", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const ip = req.ip || req.connection.remoteAddress;

      const [userLimit, ipLimit] = await Promise.all([
        checkRedisRateLimit(`rate_limit:user:${userId}`, 100, 60000),
        checkRedisRateLimit(`rate_limit:ip:${ip}`, 1000, 60000),
      ]);

      return res.json({
        success: true,
        rateLimit: {
          user: userLimit,
          ip: ipLimit,
        },
      });
    } catch (err) {
      console.error("Get rate limit error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/abuse/unblock - Request unblock (admin)
   */
  router.post("/unblock", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    const client = await pool.connect();

    try {
      const adminId = req.auth.userId;
      const isAdmin = req.auth.role === "admin" || req.user?.is_admin === true;

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { type, targetId } = req.body;

      if (!type || !targetId) {
        return res.status(400).json({
          success: false,
          error: "type and targetId required",
        });
      }

      await client.query("BEGIN");

      if (type === "user") {
        await client.query(
          `UPDATE users
           SET
             account_status = 'SUSPENDED' = FALSE,
             banned_at = NULL,
             ban_reason = NULL,
             ban_expires_at = NULL
           WHERE id = $1`,
          [targetId]
        );
      } else if (type === "ip") {
        await client.query(
          `UPDATE blocked_ips
           SET
             is_blocked = FALSE,
             blocked_at = NULL,
             block_reason = NULL,
             block_expires_at = NULL
           WHERE ip = $1`,
          [targetId]
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: `${type} unblocked`,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Unblock rollback error:", rollbackError.message);
      }
      console.error("Unblock error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/abuse/logs - View abuse logs (admin)
   */
  router.get("/logs", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const isAdmin = req.auth.role === "admin" || req.user?.is_admin === true;

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = parseInt(req.query.offset) || 0;
      const type = req.query.type || null;

      let query = `
        SELECT
          id,
          reporter_id,
          type,
          target_id,
          reason,
          description,
          status,
          created_at
        FROM abuse_reports
        WHERE 1=1
      `;

      const params = [];

      if (type) {
        query += ` AND type = $${params.length + 1}`;
        params.push(type);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        logs: result.rows.map((row) => ({
          id: row.id,
          reporterId: row.reporter_id,
          type: row.type,
          targetId: row.target_id,
          reason: row.reason,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
        })),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get abuse logs error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/abuse/block-ip - Block IP (admin)
   */
  router.post("/block-ip", authMiddleware, requireRole('ADMIN', 'MODERATOR'), async (req, res) => {
    const client = await pool.connect();

    try {
      const adminId = req.auth.userId;
      const isAdmin = req.auth.role === "admin" || req.user?.is_admin === true;

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      const { ip, reason, duration } = req.body;

      if (!ip) {
        return res.status(400).json({
          success: false,
          error: "ip required",
        });
      }

      await client.query("BEGIN");

      await client.query(
        `INSERT INTO blocked_ips (
          ip,
          reason,
          block_duration,
          blocked_at,
          block_expires_at
        )
        VALUES ($1, $2, $3, NOW(), NOW() + ($3 || ' milliseconds')::interval)
        ON CONFLICT (ip)
        DO UPDATE SET
          reason = EXCLUDED.reason,
          block_duration = EXCLUDED.block_duration,
          blocked_at = NOW(),
          block_expires_at = EXCLUDED.block_expires_at,
          is_blocked = TRUE`,
        [ip, reason || null, duration || rateLimits.BLOCK_DURATION]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        ip,
        blocked: true,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Block IP rollback error:", rollbackError.message);
      }
      console.error("Block IP error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  return router;
};