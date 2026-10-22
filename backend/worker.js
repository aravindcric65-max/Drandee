const { Pool } = require("pg");
require("dotenv").config();

// Initialize DB pool just for the worker
const isLocalDatabase =
  process.env.DATABASE_URL?.includes("localhost") ||
  process.env.DATABASE_URL?.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabase
    ? false
    : {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      },
});

// Simple In-Memory Queue
const jobQueue = [];
let isProcessing = false;

// Mock transcode function
const processTranscoding = async (job) => {
  const { sessionId } = job;
  console.log(`[Worker] Started transcoding for session: ${sessionId}`);
  
  try {
    // 1. Update status to 'processing'
    await pool.query(
      `UPDATE upload_sessions SET status = $1, updated_at = NOW() WHERE id = $2`,
      ['processing', sessionId]
    );

    // Simulate 1080p encoding (takes some time)
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`[Worker] 1080p transcoded for session: ${sessionId}`);

    // Simulate 720p encoding
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`[Worker] 720p transcoded for session: ${sessionId}`);

    // Simulate HLS generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`[Worker] HLS playlists generated for session: ${sessionId}`);

    // 2. Update status to 'ready' (which means fully completed)
    await pool.query(
      `UPDATE upload_sessions SET status = $1, updated_at = NOW() WHERE id = $2`,
      ['ready', sessionId]
    );
    
    console.log(`[Worker] Job completed successfully: ${sessionId}`);
  } catch (error) {
    console.error(`[Worker] Error processing job ${sessionId}:`, error);
    // Mark as failed
    await pool.query(
      `UPDATE upload_sessions SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
      ['failed', error.message, sessionId]
    );
  }
};

const processNextJob = async () => {
  if (isProcessing || jobQueue.length === 0) return;
  
  isProcessing = true;
  const job = jobQueue.shift();
  
  await processTranscoding(job);
  
  isProcessing = false;
  // Process next job if any
  if (jobQueue.length > 0) {
    processNextJob();
  }
};

// Expose API to add jobs
const addJob = (jobType, data) => {
  console.log(`[Worker] New job added: ${jobType} for session ${data.sessionId}`);
  jobQueue.push({ type: jobType, ...data });
  processNextJob();
};

module.exports = {
  addJob
};
