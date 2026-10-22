require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { logger, workerLogger } = require('../utils/logger');

// Shared Redis Connection for BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  logger.error({ err, queue: 'redis' }, 'Worker Redis connection error');
});

// Initialize Queues (so the worker script can optionally push to them, or just be aware)
const dataExportQueue = new Queue('DataExport', { connection });
const accountDeletionQueue = new Queue('AccountDeletion', { connection });

// Load job handlers
const dataExportHandler = require('./jobs/dataExport');
const accountDeletionHandler = require('./jobs/accountDeletion');

const { pool } = require('../config/database');
const scheduler = require('./scheduler');

console.log('[WORKER] Starting...');
const wLog = logger.child({ service: 'drandee-worker' });
wLog.info('Worker process starting');

let isShuttingDown = false;

// 1. Health Checks
async function runHealthChecks() {
  try {
    // Check Redis
    await connection.ping();
    wLog.info('Redis connected');

    // Check PostgreSQL
    const dbCheck = await pool.query('SELECT 1 as healthy');
    if (!dbCheck.rows || dbCheck.rows[0].healthy !== 1) {
      throw new Error('PostgreSQL returned invalid health check');
    }
    wLog.info('PostgreSQL connected');

  } catch (err) {
    wLog.fatal({ err }, 'Startup health check failed');
    process.exit(1);
  }
}

// 2. Data Export Worker
const dataExportWorker = new Worker('DataExport', async (job) => {
  if (isShuttingDown) return;
  const jLog = workerLogger('DataExport', job.id, job.name);
  jLog.info('Job started');
  await dataExportHandler(job.data);
}, { connection, concurrency: 5 });

dataExportWorker.on('ready', () => wLog.info({ queue: 'DataExport' }, 'Worker ready'));
dataExportWorker.on('completed', (job) => workerLogger('DataExport', job.id, job.name).info('Job completed'));
dataExportWorker.on('failed', (job, err) => workerLogger('DataExport', job?.id, job?.name).error({ err }, 'Job failed'));

// NEW: Media Cleanup Worker
const mediaCleanupWorker = new Worker('MediaCleanup', async (job) => {
  if (isShuttingDown) return;
  const jLog = workerLogger('MediaCleanup', job.id, job.name);
  jLog.info('Job started');
  const mediaCleanupHandler = require('./jobs/mediaCleanup');
  await mediaCleanupHandler(job.data);
}, {
  connection,
  concurrency: 5,
  lockDuration: 30000 // 30s lock
});

mediaCleanupWorker.on('ready', () => wLog.info({ queue: 'MediaCleanup' }, 'Worker ready'));
mediaCleanupWorker.on('completed', (job) => workerLogger('MediaCleanup', job.id, job.name).info('Job completed'));
mediaCleanupWorker.on('failed', (job, err) => workerLogger('MediaCleanup', job?.id, job?.name).error({ err }, 'Job failed'));

// 3. Account Deletion Worker
const accountDeletionWorker = new Worker('AccountDeletion', async (job) => {
  if (isShuttingDown) return;
  const jLog = workerLogger('AccountDeletion', job.id, job.name);
  jLog.info('Job started');
  await accountDeletionHandler(job.data);
}, { connection, concurrency: 1 });

accountDeletionWorker.on('ready', () => wLog.info({ queue: 'AccountDeletion' }, 'Worker ready'));
accountDeletionWorker.on('completed', (job) => workerLogger('AccountDeletion', job.id, job.name).info('Job completed'));
accountDeletionWorker.on('failed', (job, err) => workerLogger('AccountDeletion', job?.id, job?.name).error({ err }, 'Job failed'));

// NEW: Analytics Worker
const analyticsWorker = new Worker('Analytics', async (job) => {
  if (isShuttingDown) return;
  const analyticsHandler = require('./jobs/analytics');
  await analyticsHandler(job.data);
}, { connection, concurrency: 10 });

analyticsWorker.on('failed', (job, err) => workerLogger('Analytics', job?.id, job?.name).error({ err }, 'Job failed'));

// 4. Initialize
async function init() {
  await runHealthChecks();
  scheduler.start(connection);
  wLog.info('Scheduler ready');
  wLog.info('Worker fully operational');
}
init();

// 5. Graceful Shutdown
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  wLog.info({ signal }, 'Shutdown signal received');

  try {
    wLog.info('Stopping scheduler');
    scheduler.stop();

    wLog.info('Closing workers');
    await dataExportWorker.close();
    await accountDeletionWorker.close();
    await mediaCleanupWorker.close();
    await analyticsWorker.close();

    wLog.info('Closing Redis');
    await connection.quit();

    wLog.info('Closing PostgreSQL');
    await pool.end();

    wLog.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    wLog.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = {
  dataExportQueue,
  accountDeletionQueue,
  connection
};
