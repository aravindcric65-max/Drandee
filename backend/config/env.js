'use strict';

require('dotenv').config();
const { logger } = require('../utils/logger');

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
];

function validateEnv() {
  const missingRequired = [];

  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName] || String(process.env[varName]).trim() === '') {
      missingRequired.push(varName);
    }
  }

  if (missingRequired.length > 0) {
    const errorMsg = `FATAL: Missing required environment variables: ${missingRequired.join(', ')}`;
    logger.fatal({ missing: missingRequired }, errorMsg);
    console.error(errorMsg);
    process.exit(1);
  }

  // Warn about optional services
  if (!process.env.REDIS_URL) {
    logger.warn('Redis disabled (REDIS_URL absent); caching and velocity signals disabled');
  }

  const hasFirebaseCreds = process.env.FIREBASE_PROJECT_ID && 
    (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY));
  if (!hasFirebaseCreds) {
    logger.warn('Firebase credentials absent; phone/social auth features will use dev fallback');
  }

  const hasImageKit = process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT;
  if (!hasImageKit) {
    logger.warn('ImageKit credentials absent; upload features will use local storage fallback');
  }

  return {
    PORT: Number(process.env.PORT) || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
  };
}

module.exports = { validateEnv };
