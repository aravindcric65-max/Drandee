const { redisClient } = require('../utils/antiBot');

/**
 * Tracks API request rates, latencies, and status codes in Redis
 */
const metricsMiddleware = (req, res, next) => {
  if (!redisClient) return next();
  
  const start = Date.now();
  
  res.on('finish', () => {
    try {
      const duration = Date.now() - start;
      const status = res.statusCode;
      
      // Normalize route to prevent high cardinality (e.g., /api/user/123 -> /api/user/:id)
      let route = req.route ? req.route.path : req.path;
      // Basic normalization for numeric IDs
      route = route.replace(/\/\d+/g, '/:id');
      
      const method = req.method;
      
      const key = `metrics:api:${method}:${route}`;
      const multi = redisClient.multi();
      
      multi.hincrby(key, 'count', 1);
      multi.hincrby(key, 'total_time', duration);
      multi.hincrby(key, `status:${status}`, 1);
      
      // Expire after 24 hours to prevent memory bloat
      multi.expire(key, 86400);
      
      multi.exec().catch(err => console.warn('[Metrics] Redis error:', err.message));
    } catch (err) {
      console.warn('[Metrics] Error:', err.message);
    }
  });
  
  next();
};

module.exports = metricsMiddleware;
