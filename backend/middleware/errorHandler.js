'use strict';

const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred';
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let details = undefined;

  // Handle common PostgreSQL error codes
  if (err.code === '23505') {
    // unique_violation
    statusCode = 409;
    code = 'CONFLICT';
    message = 'Resource already exists';
    details = isProd ? undefined : err.detail;
  } else if (err.code === '23503') {
    // foreign_key_violation
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Referenced resource does not exist';
    details = isProd ? undefined : err.detail;
  } else if (err.code === '22P02') {
    // invalid_text_representation (e.g. invalid integer/uuid)
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = 'Invalid input format';
  } else if (err.code === '42703') {
    // undefined_column
    statusCode = 500;
    code = 'SCHEMA_ERROR';
    message = isProd ? 'An unexpected error occurred' : 'Database column mismatch (42703)';
    logger.fatal({
      err: err.message,
      code: err.code,
      requestId: req.requestId,
      method: req.method,
      route: req.originalUrl,
    }, 'CRITICAL: PostgreSQL 42703 undefined_column error');
  }

  // Log error
  if (statusCode >= 500 && err.code !== '42703') {
    logger.error({
      err: err.message,
      stack: isProd ? undefined : err.stack,
      requestId: req.requestId,
      method: req.method,
      route: req.originalUrl,
    }, 'Unhandled server error');
  } else if (statusCode >= 400 && statusCode < 500) {
    logger.warn({
      message,
      code,
      statusCode,
      requestId: req.requestId,
      method: req.method,
      route: req.originalUrl,
    }, 'Client error response');
  }

  const responseBody = {
    error: {
      message,
      code,
      ...(details !== undefined && { details }),
      ...(!isProd && err.stack && { stack: err.stack }),
    },
  };

  return res.status(statusCode).json(responseBody);
}

module.exports = errorHandler;
