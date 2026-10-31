const express = require('express');

module.exports = (pool) => {
const router = express.Router();
const crypto = require('crypto');

// ImageKit configuration — lazy/optional init to avoid startup crash when env vars are absent
const ImageKit = require('imagekit');
const IMAGEKIT_CONFIGURED = !!(
  process.env.IMAGEKIT_PUBLIC_KEY &&
  process.env.IMAGEKIT_PRIVATE_KEY &&
  process.env.IMAGEKIT_URL_ENDPOINT
);
let imagekit = null;
if (IMAGEKIT_CONFIGURED) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
} else {
  console.warn('[media] ImageKit not configured — upload signature routes will return 503');
}

// Middleware
const authMiddleware = require('../middleware/auth');

// Reuse BullMQ queue connection
let mediaCleanupQueue = null;
function getMediaCleanupQueue() {
  if (!mediaCleanupQueue) {
    const { Queue } = require('bullmq');
    const IORedis = require('ioredis');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    mediaCleanupQueue = new Queue('MediaCleanup', { connection });
  }
  return mediaCleanupQueue;
}

// GET /api/media/upload-signature
router.post('/upload-signature', authMiddleware, async (req, res) => {
  try {
    if (!imagekit) {
      return res.status(503).json({ success: false, error: 'Media service not configured' });
    }
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType || !fileSize) {
      return res.status(400).json({
        success: false,
        error: 'fileName, fileType, and fileSize are required',
      });
    }

    // Generate unique publicId
    const publicId = `drandee/${req.auth.userId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    // Get signature from ImageKit
    const expire = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const signature = imagekit.getAuthenticationParameters(expire);

    res.json({
      success: true,
      signature: signature.signature,
      expire: signature.expire,
      uploadParams: {
        publicId,
        tags: ['drandee', 'user-content'],
        customCoordinates: {
          userId: req.auth.userId,
        },
      },
    });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload signature',
    });
  }
});

// POST /api/media
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { mediaId, videoUrl, caption, hashtags, privacy, sound, cover, aspectRatio } = req.body;

    if (!mediaId || !videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'mediaId and videoUrl are required',
      });
    }

    // Insert into database
    const result = await pool.query(
      `INSERT INTO media (
        user_id, media_id, video_url, caption, hashtags, 
        privacy, sound, cover, aspect_ratio, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', NOW())
      RETURNING *`,
      [
        req.auth.userId,
        mediaId,
        videoUrl,
        caption || '',
        JSON.stringify(hashtags || []),
        privacy || 'public',
        sound ? JSON.stringify(sound) : null,
        cover ? JSON.stringify(cover) : null,
        aspectRatio || '9:16',
      ]
    );

    res.status(201).json({
      success: true,
      media: result.rows[0],
    });
  } catch (error) {
    console.error('Create media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create media',
    });
  }
});

// POST /api/upload/process
router.post('/upload/process', authMiddleware, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    
    // Create an upload job
    const result = await pool.query(
      `INSERT INTO upload_jobs (user_id, video_url, status, progress, stage)
       VALUES ($1, $2, 'processing', 0, 'uploading')
       RETURNING id`,
      [req.auth.userId, videoUrl]
    );

    res.json({ success: true, jobId: result.rows[0].id });
  } catch (error) {
    console.error('Process media error:', error);
    res.status(500).json({ success: false, error: 'Failed to start processing' });
  }
});

// GET /api/upload/status/:job_id
router.get('/upload/status/:job_id', authMiddleware, async (req, res) => {
  try {
    const jobId = parseInt(req.params.job_id, 10);
    const result = await pool.query(
      `SELECT status, progress, stage, error_message FROM upload_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, req.auth.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({ success: true, job: result.rows[0] });
  } catch (error) {
    console.error('Job status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get job status' });
  }
});


// PATCH /api/media/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const mediaCheck = await pool.query(
      'SELECT * FROM media WHERE id = $1 AND user_id = $2',
      [id, req.auth.userId]
    );

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Media not found',
      });
    }

    // Build update query
    const allowedFields = ['caption', 'hashtags', 'privacy', 'sound', 'cover', 'aspect_ratio'];
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramIndex}`);
        updateValues.push(updates[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    updateValues.push(id, req.auth.userId);

    const result = await pool.query(
      `UPDATE media SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      updateValues
    );

    res.json({
      success: true,
      media: result.rows[0],
    });
  } catch (error) {
    console.error('Update media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update media',
    });
  }
});

// POST /api/media/:id/publish
router.post('/:id/publish', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const mediaCheck = await pool.query(
      'SELECT * FROM media WHERE id = $1 AND user_id = $2',
      [id, req.auth.userId]
    );

    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Media not found',
      });
    }

    const result = await pool.query(
      `UPDATE media SET status = 'published', published_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.auth.userId]
    );

    res.json({
      success: true,
      media: result.rows[0],
    });
  } catch (error) {
    console.error('Publish media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish media',
    });
  }
});

// POST /api/media/:id/draft
router.post('/:id/draft', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE media SET status = 'draft', updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.auth.userId]
    );

    res.json({
      success: true,
      media: result.rows[0],
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save draft',
    });
  }
});

// GET /api/media/:id/status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT status, processing_progress FROM media WHERE id = $1 AND user_id = $2',
      [id, req.auth.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Media not found',
      });
    }

    res.json({
      success: true,
      status: result.rows[0].status,
      progress: result.rows[0].processing_progress || 0,
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
    });
  }
});

// DELETE /api/media/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM media WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.auth.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const media = result.rows[0];

    // Queue BullMQ job for physical cleanup using the returned metadata
    const queue = getMediaCleanupQueue();

    await queue.add('cleanupMedia', { 
      mediaId: media.id,
      storage_provider: media.storage_provider,
      provider_file_id: media.provider_file_id,
      url: media.url 
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      jobId: `cleanup_media_${media.id}` // Idempotency
    });

    res.json({ success: true, message: 'Media deletion queued' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete media' });
  }
});

// GET /api/media/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM media WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Media not found',
      });
    }

    res.json({
      success: true,
      media: result.rows[0],
    });
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get media',
    });
  }
});

// GET /api/media/user/:userId
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT * FROM media 
       WHERE user_id = $1 AND status = 'published'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM media WHERE user_id = $1 AND status = \'published\'',
      [userId]
    );

    res.json({
      success: true,
      media: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        hasMore: result.rows.length === limit,
      },
    });
  } catch (error) {
    console.error('Get user media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user media',
    });
  }
});

  return router;
};