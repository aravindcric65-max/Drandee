const express = require("express");

module.exports = (pool, redisClient) => {
  const router = express.Router();

  // Rate limiting - prevent abuse (100 req/min per IP)
  const rateLimits = {
    MAX_HEALTH_REQUESTS_PER_MINUTE: 100,
    ipRequests: new Map(),
  };

  const checkRateLimit = (ip) => {
    const now = Date.now();
    const ipReqs = rateLimits.ipRequests.get(ip) || [];
    const recentReqs = ipReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_HEALTH_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.ipRequests.set(ip, recentReqs);
    return true;
  };

  // Production guard for sensitive endpoints
  const requireMonitoringSecret = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') return next();
    const secret = process.env.MONITORING_SECRET;
    if (!secret) return res.status(404).json({ success: false, status: 'not_found' }); // fail closed when unconfigured
    const provided = req.headers['x-monitoring-secret'];
    if (provided !== secret) {
      return res.status(403).json({ success: false, status: 'forbidden' });
    }
    return next();
  };

  // In-memory metrics (no external deps)
  const metrics = {
    requests: 0,
    errors: 0,
    startTime: Date.now(),
    lastCheck: Date.now(),
  };

  const incrementRequest = () => {
    metrics.requests++;
    metrics.lastCheck = Date.now();
  };

  const incrementError = () => {
    metrics.errors++;
  };

  // Memory & CPU monitoring (lightweight)
  const getMemoryUsage = () => {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    };
  };

  const getUptime = () => {
    return Math.round(process.uptime());
  };

  /*
   * GET /api/health - Basic health check (ultra-fast, <1ms)
   */
  router.get("/", (req, res) => {
    incrementRequest();

    const ip = req.ip || req.connection.remoteAddress;
    
    if (!checkRateLimit(ip)) {
      incrementError();
      return res.status(429).json({
        success: false,
        status: "rate_limited",
        message: "Too many health checks",
      });
    }

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    return res.json({
      success: true,
      status: "ok",
      timestamp: Date.now(),
      uptime: getUptime(),
    });
  });

  /*
   * GET /api/health/live - Liveness check (Kubernetes)
   */
  router.get("/live", (req, res) => {
    incrementRequest();

    // Always return ok if server is running
    return res.json({
      success: true,
      status: "alive",
      timestamp: Date.now(),
    });
  });

  /*
   * GET /api/health/ready - Readiness check (traffic-ready?)
   */
  router.get("/ready", async (req, res) => {
    incrementRequest();

    try {
      // Check if pool exists
      if (!pool) {
        incrementError();
        return res.status(503).json({
          success: false,
          status: "not_ready",
          reason: "Database pool not initialized",
          timestamp: Date.now(),
        });
      }

      // Quick pool check (no query, just check state)
      const poolState = {
        total: pool.totalCount || 0,
        idle: pool.idleCount || 0,
        waiting: pool.waitingCount || 0,
      };

      // Ready if pool exists and not exhausted
      const isReady = poolState.waiting < 10;

      if (!isReady) {
        incrementError();
        return res.status(503).json({
          success: false,
          status: "not_ready",
          reason: "Database pool exhausted",
          pool: poolState,
          timestamp: Date.now(),
        });
      }

      return res.json({
        success: true,
        status: "ready",
        pool: poolState,
        timestamp: Date.now(),
      });
    } catch (err) {
      incrementError();
      return res.status(503).json({
        success: false,
        status: "not_ready",
        reason: err.message,
        timestamp: Date.now(),
      });
    }
  });

  /*
   * GET /api/health/detailed - Full health (DB, Redis, memory, CPU)
   */
  router.get("/detailed", requireMonitoringSecret, async (req, res) => {
    incrementRequest();

    const startTime = Date.now();
    const health = {
      success: true,
      status: "ok",
      timestamp: startTime,
      uptime: getUptime(),
      services: {},
      memory: getMemoryUsage(),
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        errorRate: metrics.requests > 0 ? ((metrics.errors / metrics.requests) * 100).toFixed(2) : 0,
      },
    };

    try {
      // Database check (with timeout)
      const dbCheck = new Promise(async (resolve) => {
        try {
          const timeout = setTimeout(() => {
            resolve({ status: "timeout", latency: 5000 });
          }, 5000);

          const queryStart = Date.now();
          await pool.query("SELECT 1");
          const latency = Date.now() - queryStart;

          clearTimeout(timeout);

          const poolState = {
            total: pool.totalCount || 0,
            idle: pool.idleCount || 0,
            waiting: pool.waitingCount || 0,
          };

          resolve({
            status: "ok",
            latency,
            pool: poolState,
          });
        } catch (err) {
          resolve({
            status: "error",
            error: err.message,
          });
        }
      });

      // Redis check (with timeout)
      const redisCheck = new Promise(async (resolve) => {
        if (!redisClient) {
          resolve({ status: "not_configured" });
          return;
        }

        try {
          const timeout = setTimeout(() => {
            resolve({ status: "timeout", latency: 5000 });
          }, 5000);

          const pingStart = Date.now();
          await redisClient.ping();
          const latency = Date.now() - pingStart;

          clearTimeout(timeout);

          resolve({
            status: "ok",
            latency,
          });
        } catch (err) {
          resolve({
            status: "error",
            error: err.message,
          });
        }
      });

      const [db, redis] = await Promise.all([dbCheck, redisCheck]);

      health.services.database = db;
      health.services.redis = redis;

      // Overall status
      const allHealthy =
        db.status === "ok" &&
        (redis.status === "ok" || redis.status === "not_configured");

      const responseTime = Date.now() - startTime;
      health.responseTime = responseTime;

      if (!allHealthy) {
        health.status = "degraded";
        return res.status(503).json(health);
      }

      return res.json(health);
    } catch (err) {
      incrementError();
      health.success = false;
      health.status = "error";
      health.error = err.message;
      health.responseTime = Date.now() - startTime;

      return res.status(503).json(health);
    }
  });

  /*
   * GET /api/health/metrics - Performance metrics
   */
  router.get("/metrics", requireMonitoringSecret, (req, res) => {
    incrementRequest();

    const uptime = getUptime();
    const mem = getMemoryUsage();

    const metricsResponse = {
      success: true,
      uptime,
      memory: mem,
      requests: {
        total: metrics.requests,
        errors: metrics.errors,
        errorRate: metrics.requests > 0 ? ((metrics.errors / metrics.requests) * 100).toFixed(2) : 0,
      },
      timestamp: Date.now(),
    };

    // Add pool stats if available
    if (pool) {
      metricsResponse.database = {
        total: pool.totalCount || 0,
        idle: pool.idleCount || 0,
        waiting: pool.waitingCount || 0,
      };
    }

    // Add Redis stats if available
    if (redisClient) {
      metricsResponse.redis = {
        connected: redisClient.isReady || false,
      };
    }

    return res.json(metricsResponse);
  });

  /*
   * GET /api/health/stats - Quick stats (for dashboards)
   */
  router.get("/stats", requireMonitoringSecret, (req, res) => {
    incrementRequest();

    const mem = getMemoryUsage();

    return res.json({
      success: true,
      uptime: getUptime(),
      memory: {
        used: mem.heapUsed,
        total: mem.heapTotal,
        rss: mem.rss,
      },
      requests: metrics.requests,
      errors: metrics.errors,
      timestamp: Date.now(),
    });
  });

  return router;
};