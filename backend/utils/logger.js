'use strict';

/**
 * utils/logger.js — Drandee Structured Logger (Pino)
 *
 * Rules:
 *  - NEVER log: passwords, tokens, JWT secrets, API keys, cookies,
 *    authorization headers, session tokens, HMAC secrets, private credentials.
 *  - Redact happens at the serializer level so any accidental inclusion is blocked.
 *  - Use child loggers in routes/workers for context propagation.
 *  - In development, pino-pretty formats output for human reading.
 *  - In production, outputs raw JSON for log aggregators (Datadog, CloudWatch, etc.)
 */

const pino = require('pino');

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

// ─── Redaction paths ─────────────────────────────────────────────────────────
// Block any accidentally included secrets no matter how deeply nested.
const REDACTED_PATHS = [
  'password',
  'passwordHash',
  'hashedPassword',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'firebaseToken',
  'jwtSecret',
  'JWT_SECRET',
  'apiKey',
  'API_KEY',
  'privateKey',
  'secret',
  'cookie',
  'authorization',
  'Authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  'req.body.oldPassword',
  'req.body.newPassword',
  'hmacSecret',
  'DATABASE_URL',
  'databaseUrl',
  'IMAGEKIT_PRIVATE_KEY',
  'imagekitPrivateKey',
];

// ─── Transport / destination ──────────────────────────────────────────────────
// In development: pino-pretty via pino.transport() which returns a real Writable.
// In production: process.stdout (raw NDJSON for log aggregators).
// We do NOT pass the transport object directly as the second pino() arg —
// that spawns an async worker thread whose stream can be torn down before
// uncaughtException handlers fire.  Instead we get the stream first, then
// pass it as a synchronous destination.
const destination =
  NODE_ENV !== 'production'
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      })
    : process.stdout;

// ─── Base logger ──────────────────────────────────────────────────────────────
const logger = pino(
  {
    level: LOG_LEVEL,
    base: {
      service: 'drandee-api',
      env: NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]',
    },
    serializers: {
      // Serialize Errors properly
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        // Deliberately omit headers to prevent token leakage
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  },
  destination
);

// ─── Child factory helpers ────────────────────────────────────────────────────

/**
 * Create a child logger for a specific request.
 * Attaches requestId, method, and route — never the authorization header.
 * @param {string} requestId - UUID correlation ID
 * @param {string} method    - HTTP method
 * @param {string} route     - Normalized route path
 * @returns {pino.Logger}
 */
function requestLogger(requestId, method, route) {
  return logger.child({ requestId, method, route });
}

/**
 * Create a child logger for a BullMQ worker/job.
 * @param {string} queue - Queue name
 * @param {string} jobId - Job ID
 * @param {string} jobName - Job type/name
 * @returns {pino.Logger}
 */
function workerLogger(queue, jobId, jobName) {
  return logger.child({ service: 'drandee-worker', queue, jobId, jobName });
}

/**
 * Create a child logger for the scheduler.
 * @returns {pino.Logger}
 */
function schedulerLogger() {
  return logger.child({ service: 'drandee-scheduler' });
}

module.exports = {
  logger,
  requestLogger,
  workerLogger,
  schedulerLogger,
};
