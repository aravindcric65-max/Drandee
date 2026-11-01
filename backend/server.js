'use strict';

const { validateEnv } = require('./config/env');
const env = validateEnv();

const app = require('./app');
const { logger } = require('./utils/logger');
const { pool } = require('./config/database');
const { ensureRedis, closeRedis, redisEnabled } = require('./utils/engagementVelocity');

const PORT = env.PORT;
const NODE_ENV = env.NODE_ENV;

let server;
let isShuttingDown = false;
let redisReady = false;

// ============================================
// Graceful Shutdown
// ============================================
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received');

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced exit after 10s timeout');
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed');
    }
    await pool.end();
    logger.info('Database pool closed');
    if (redisReady && redisEnabled) {
      await closeRedis();
      logger.info('Redis connection closed');
    }
    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error.message }, 'Shutdown error');
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error.message }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

// ============================================
// Boot & Listen
// ============================================
async function startServer() {
  try {
    // 1. Verify PostgreSQL connectivity
    await pool.query('SELECT 1');
    logger.info('Connected to PostgreSQL database');

    // 2. Connect Redis (optional service)
    try {
      const client = await ensureRedis();
      redisReady = client.isOpen || client.isReady || false;
      if (redisReady && redisEnabled) {
        logger.info('Connected to Redis');
      } else if (!redisEnabled) {
        logger.info('Redis is disabled — running without Redis velocity signals');
      }
    } catch (err) {
      redisReady = false;
      logger.warn('Redis unavailable — server will continue without Redis signals');
    }

    // 3. Start HTTP server
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info({
        port: PORT,
        env: NODE_ENV,
        redis: redisEnabled ? (redisReady ? 'connected' : 'unavailable') : 'disabled',
      }, 'Drandee API server started');
    });

    return server;
  } catch (error) {
    logger.fatal({ err: error.message }, 'Database connection failed — server cannot start');
    process.exit(1);
  }
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.fatal({ err: error.message }, 'Server start failed');
    process.exit(1);
  });
}

module.exports = { startServer, app };
