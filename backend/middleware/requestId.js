'use strict';

/**
 * middleware/requestId.js — Correlation ID injector
 *
 * Attaches a unique requestId to every incoming HTTP request.
 * The ID is:
 *  - read from X-Request-ID header if the client / load-balancer sends one
 *  - otherwise generated as a crypto UUID
 *
 * The ID is attached to:
 *  - req.requestId           (used by route handlers / error handler)
 *  - res header X-Request-ID (returned to clients for tracing)
 *
 * NEVER expose internal security data through this header.
 */

const { randomUUID } = require('crypto');

function requestIdMiddleware(req, res, next) {
  // Accept an upstream correlation ID or generate one
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = requestIdMiddleware;
