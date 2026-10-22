const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { normalizeMediaUrl } = require('../utils/mediaUrl');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});

const upload = multer({ storage: storage });

module.exports = (pool) => {
// ═════════════════════════════════════════════════════════
// HELPER: Normalize content type to canonical form
// ═════════════════════════════════════════════════════════
function normalizeContentType(mimeType, postType) {
  const pType = String(postType || '').toLowerCase();
  if (pType === 'carousel') return 'carousel';
  if (pType === 'text' || pType === 'discussion') return 'text';
  
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('image/')) return 'image';
  
  if (pType === 'video' || pType === 'reel') return 'video';
  if (pType === 'photo' || pType === 'image') return 'image';
  
  return 'text'; // fallback
}

// ═════════════════════════════════════════════════════════
// 1. CREATE UPLOAD SESSION
// ═════════════════════════════════════════════════════════

// NEW: Simple Avatar Upload
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No image uploaded' } });
    }
    // Mime type validation
    if (!req.file.mimetype.startsWith('image/')) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, error: { message: 'Invalid file format. Please upload an image.' } });
    }

    const storageUrl = normalizeMediaUrl(`/uploads/${req.file.filename}`);

    // Optionally update user directly here, but frontend will call PUT /api/settings/profile
    return res.json({
      success: true,
      url: storageUrl
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
});

router.post('/session', authMiddleware, async (req, res) => {
  const { mediaType, fileName, fileSize } = req.body;
  const userId = req.auth.userId; // From auth middleware
  
  // Validate authentication
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
  
  // Validate input
  if (!mediaType || !fileName) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'mediaType and fileName are required' }
    });
  }
  
  // Validate file size (max 100MB)
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  if (fileSize && fileSize > MAX_FILE_SIZE) {
    return res.status(400).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: 'File size must be less than 100MB' }
    });
  }
  
  // Validate media type
  const ALLOWED_MEDIA_TYPES = [
    'video/mp4',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];
  
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return res.status(400).json({
      success: false,
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type' }
    });
  }
  
  try {
    // Generate unique session ID
    const sessionId = crypto.randomUUID();
    
    // Generate storage key
    const ext = fileName.split('.').pop();
    const timestamp = Date.now();
    const storageKey = `uploads/${userId}/${timestamp}_${sessionId}.${ext}`;
    
    // Create upload session in database
    const result = await pool.query(
      `INSERT INTO upload_sessions 
       (id, user_id, status, media_type, file_name, file_size, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, status, created_at, updated_at, expires_at`,
      [sessionId, userId, 'created', mediaType, fileName, fileSize, storageKey]
    );
    
    // Generate presigned URL for direct upload to storage
    const uploadUrl = await generatePresignedUrl(storageKey, mediaType, fileSize);
    
    res.json({
      success: true,
      data: {
        sessionId,
        uploadUrl,
        storageKey,
        expiresAt: result.rows[0].expires_at,
        maxFileSize: MAX_FILE_SIZE,
        allowedTypes: ALLOWED_MEDIA_TYPES
      }
    });
  } catch (error) {
    console.error('Error creating upload session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create upload session' }
    });
  }
});

// ═════════════════════════════════════════════════════════
// 2. GET UPLOAD SESSION STATUS
// ═════════════════════════════════════════════════════════

router.get('/session/:sessionId/status', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.auth.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
  
  try {
    const result = await pool.query(
      'SELECT id, status, media_type, file_name, file_size, storage_url, processing_metadata, error_message, created_at, updated_at FROM upload_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Upload session not found' }
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get session status' }
    });
  }
});

// ═════════════════════════════════════════════════════════
// 2.5. UPLOAD MEDIA TO LOCAL STORAGE (DEV ONLY)
// ═════════════════════════════════════════════════════════

router.post('/local/:sessionId', authMiddleware, upload.single('file'), async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.auth.userId;
  const file = req.file;
  
  if (!userId) {
    return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
  }
  if (!file) {
    return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
  }

  try {
    const result = await pool.query('SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Session not found' } });
    
    const storageUrl = normalizeMediaUrl(`/uploads/${file.filename}`);
    
    await pool.query(
      'UPDATE upload_sessions SET status = $1, storage_url = $2, updated_at = NOW() WHERE id = $3',
      ['ready', storageUrl, sessionId]
    );

    res.json({ success: true, data: { storageUrl, filename: file.filename } });
  } catch (error) {
    console.error('Error during local upload:', error);
    res.status(500).json({ success: false, error: { message: 'Upload failed' } });
  }
});

// ═════════════════════════════════════════════════════════
// 2.6. CHUNKED MEDIA UPLOAD
// ═════════════════════════════════════════════════════════

router.post('/chunk/:sessionId', authMiddleware, upload.single('chunk'), async (req, res) => {
  const { sessionId } = req.params;
  const { chunkIndex, totalChunks, fileName } = req.body;
  const userId = req.auth.userId;
  const file = req.file;
  
  if (!userId) {
    return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
  }
  if (!file) {
    return res.status(400).json({ success: false, error: { message: 'No chunk uploaded' } });
  }

  try {
    const result = await pool.query('SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Session not found' } });
    
    // Move chunk to a specific file
    const chunkPath = path.join(uploadDir, `${sessionId}_chunk_${chunkIndex}`);
    await fs.promises.rename(file.path, chunkPath);

    // If it's the last chunk, merge them
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
      const ext = fileName ? path.extname(fileName) : '.mp4';
      const finalFilename = `${Date.now()}-${sessionId}${ext}`;
      const finalPath = path.join(uploadDir, finalFilename);
      
      const writeStream = fs.createWriteStream(finalPath);
      for (let i = 0; i < totalChunks; i++) {
        const cp = path.join(uploadDir, `${sessionId}_chunk_${i}`);
        try {
          await fs.promises.access(cp);
        } catch {
          throw new Error(`Missing chunk ${i}`);
        }
        const data = await fs.promises.readFile(cp);
        writeStream.write(data);
        await fs.promises.unlink(cp).catch(() => {}); // Clean up chunk
      }
      writeStream.end();

      const storageUrl = normalizeMediaUrl(`/uploads/${finalFilename}`);
      
      await pool.query(
        'UPDATE upload_sessions SET status = $1, storage_url = $2, updated_at = NOW() WHERE id = $3',
        ['uploading', storageUrl, sessionId]
      );

      return res.json({ success: true, data: { storageUrl, filename: finalFilename, completed: true } });
    }

    res.json({ success: true, data: { chunkIndex, completed: false } });
  } catch (error) {
    console.error('Error during chunk upload:', error);
    res.status(500).json({ success: false, error: { message: 'Chunk upload failed' } });
  }
});

// ═════════════════════════════════════════════════════════
// 3. COMPLETE UPLOAD (after media uploaded to storage)
// ═════════════════════════════════════════════════════════

router.post('/session/:sessionId/complete', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  const { processingMetadata, storageUrl } = req.body;
  const userId = req.auth.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
  
  try {
    // Verify session ownership
    const sessionResult = await pool.query(
      'SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Upload session not found' }
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Validate session status
    if (session.status !== 'created' && session.status !== 'uploading') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Upload session is not in valid state' }
      });
    }
    
    // Instead of setting to 'ready', we set it to 'processing' (or keep it 'uploading' and let worker set to processing)
    // Actually, we'll queue it for the worker to handle the transition
    await pool.query(
      `UPDATE upload_sessions 
       SET storage_url = $1,
           processing_metadata = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [storageUrl || session.storage_url, JSON.stringify(processingMetadata), sessionId]
    );
    
    // Dispatch job to the worker queue
    const { addJob } = require('../worker.js');
    addJob('transcode_video', { sessionId, userId });
    
    res.json({
      success: true,
      data: {
        sessionId,
        storageUrl: normalizeMediaUrl(storageUrl || session.storage_url),
        thumbnailUrl: normalizeMediaUrl(processingMetadata?.thumbnailUrl),
        duration: processingMetadata?.duration,
        dimensions: processingMetadata?.dimensions,
        aspectRatio: processingMetadata?.aspectRatio
      }
    });
  } catch (error) {
    console.error('Error completing upload:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to complete upload' }
    });
  }
});

// ═════════════════════════════════════════════════════════
// 4. CREATE POST
// ═════════════════════════════════════════════════════════

router.post('/posts', authMiddleware, async (req, res) => {
  const {
    sessionId,
    type,
    caption,
    hashtags,
    visibility,
    locationContext
  } = req.body;
  
  const userId = req.auth.userId;
  
  // Validate authentication
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
  
  // Validate input
  if (!type) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'type is required' }
    });
  }

  // Text posts do not have a binary file upload session
  if (type !== 'text' && type !== 'discussion' && !sessionId) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'sessionId is required for media posts' }
    });
  }
  
  // Validate content type — accepts both legacy ('photo', 'discussion', 'reel') and canonical forms
  const ALLOWED_TYPES = ['video', 'reel', 'image', 'photo', 'carousel', 'text', 'discussion'];
  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TYPE', message: 'Invalid content type' }
    });
  }
  
  // Validate caption length
  if (caption && caption.length > 2000) {
    return res.status(400).json({
      success: false,
      error: { code: 'CAPTION_TOO_LONG', message: 'Caption must be less than 2000 characters' }
    });
  }

  // Normalize tags (remove #, trim, lowercase, unique)
  let normalizedTags = [];
  if (Array.isArray(hashtags) && hashtags.length > 0) {
    normalizedTags = [...new Set(
      hashtags
        .filter(tag => typeof tag === 'string')
        .map(tag => tag.replace(/^#+/, '').trim().toLowerCase())
        .filter(tag => tag.length > 0)
    )];
  }
  // Fallback: extract hashtags from caption text if no explicit tags provided
  if (normalizedTags.length === 0 && caption) {
    const extracted = (caption.match(/#([a-zA-Z0-9_]+)/g) || [])
      .map(t => t.replace('#', '').toLowerCase());
    normalizedTags = [...new Set(extracted)].slice(0, 30); // max 30 tags
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let content = {
      videoUrl: null,
      imageUrl: null,
      thumbnailUrl: null,
      duration: null,
      aspectRatio: '1:1',
      dimensions: null,
      images: null
    };

    if (type !== 'text' && type !== 'discussion') {
      // Verify upload session
      const sessionResult = await client.query(
        'SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2 AND status = $3',
        [sessionId, userId, 'ready']
      );
      
      if (sessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SESSION', message: 'Upload session not found or not ready' }
        });
      }
      
      const session = sessionResult.rows[0];
      
      content = {
        videoUrl: session.media_type.startsWith('video') ? session.storage_url : null,
        imageUrl: session.media_type.startsWith('image') ? session.storage_url : null,
        thumbnailUrl: session.processing_metadata?.thumbnailUrl,
        duration: session.processing_metadata?.duration,
        aspectRatio: session.processing_metadata?.aspectRatio || '9:16',
        dimensions: session.processing_metadata?.dimensions,
        images: session.processing_metadata?.images || null // For carousel
      };
    }
    
    // Fetch full creator details to return a complete post object and for the insert
    const creatorResult = await client.query(
      'SELECT id, username, name, profile_pic, identity_level FROM users WHERE id = $1',
      [userId]
    );
    const creator = creatorResult.rows[0];
    
    // Determine canonical content_type
    let canonicalContentType = 'text';
    if (type !== 'text' && type !== 'discussion' && sessionId) {
      const sessionResult = await client.query('SELECT media_type FROM upload_sessions WHERE id = $1', [sessionId]);
      if (sessionResult.rows.length > 0) {
        canonicalContentType = normalizeContentType(sessionResult.rows[0].media_type, type);
      }
    } else {
      canonicalContentType = normalizeContentType(null, type);
    }
    
    // Get moderation status from environment or default to 'approved' for dev
    const moderationStatus = process.env.DEFAULT_POST_MODERATION_STATUS || 'approved';

    // Create canonical post (matches actual Neon DB schema)
    const postResult = await client.query(
      `INSERT INTO posts 
       (user_id, creator_id, creator_name, type, content_type, caption, tags, video_url, image_url, region, moderation_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        userId,
        creator.name || creator.username || 'User',
        type,
        canonicalContentType,
        caption || null,
        normalizedTags,
        content?.videoUrl ? normalizeMediaUrl(content.videoUrl) : null,
        content?.imageUrl ? normalizeMediaUrl(content.imageUrl) : null,
        'local',
        moderationStatus
      ]
    );
    
    const post = postResult.rows[0];
    
    // Mark session as used if applicable
    if (type !== 'text' && type !== 'discussion') {
      await client.query(
        'UPDATE upload_sessions SET status = $1 WHERE id = $2',
        ['used', sessionId]
      );
    }
    
    await client.query('COMMIT');
    
    const { formatPost } = require('../models/postModel');
    const formattedPost = formatPost({
      ...post,
      thumbnail_url: content?.thumbnailUrl || null,
      creator_username: creator.username,
      creator_display_name: creator.name,
      creator_avatar: creator.profile_pic,
      creator_identity_level: creator.identity_level
    });
    
    res.json({
      success: true,
      data: formattedPost
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating post [DETAILED]:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create post' }
    });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════
// 5. UPDATE POST
// ═════════════════════════════════════════════════════════

router.patch('/posts/:postId', authMiddleware, async (req, res) => {
  const { postId } = req.params;
  const { caption, hashtags, visibility, locationContext } = req.body;
  const userId = req.auth.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
  
  try {
    // Verify post ownership
    const postResult = await pool.query(
      'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
      [postId, userId]
    );
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Post not found' }
      });
    }
    
    // Build update fields
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (caption !== undefined) {
      updates.push(`caption = $${paramIndex++}`);
      values.push(caption);
    }
    
    if (hashtags !== undefined) {
      updates.push(`hashtags = $${paramIndex++}`);
      values.push(hashtags);
    }
    
    if (visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      values.push(visibility);
    }
    
    if (locationContext !== undefined) {
      updates.push(`location_context = $${paramIndex++}`);
      values.push(locationContext ? JSON.stringify(locationContext) : null);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(postId, userId);
    
    const updateQuery = `
      UPDATE posts 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
      RETURNING id, caption, hashtags, visibility, location_context, updated_at
    `;
    
    const result = await pool.query(updateQuery, values);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update post' }
    });
  }
});

// ═════════════════════════════════════════════════════════
// 6. DELETE POST
// ═════════════════════════════════════════════════════════

router.delete('/posts/:postId', authMiddleware, async (req, res) => {
  const { postId } = req.params;
  const userId = req.auth.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
  
  try {
    // Soft delete - update status to removed
    const result = await pool.query(
      `UPDATE posts 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      ['removed', postId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Post not found' }
      });
    }
    
    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to delete post' }
    });
  }
});

// ═════════════════════════════════════════════════════════
// HELPER: Determine distribution eligibility
// ═════════════════════════════════════════════════════════

function determineDistributionEligibility(type, locationContext, visibility) {
  const distribution = {
    home: true,
    following: true,
    reels: false,
    local: false
  };
  
  // Video can go to Reels
  if (type === 'video') {
    distribution.reels = true;
  }
  
  // Location context enables Local (only for public posts)
  if (locationContext && visibility === 'public') {
    distribution.local = true;
  }
  
  // Text/Discussion always eligible for Home
  if (type === 'text' || type === 'discussion') {
    distribution.home = true;
  }
  
  // Private posts only visible to followers
  if (visibility === 'private') {
    distribution.home = false;
    distribution.reels = false;
    distribution.local = false;
  }
  
  return distribution;
}

// ═════════════════════════════════════════════════════════
// HELPER: Generate presigned URL (placeholder)
// ═════════════════════════════════════════════════════════

async function generatePresignedUrl(storageKey, mediaType, fileSize) {
  // If in local dev without S3, return a special local upload URL
  if (process.env.NODE_ENV !== 'production' && !process.env.AWS_ACCESS_KEY_ID) {
    const sessionId = storageKey.split('_').pop().split('.')[0];
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/upload/local/${sessionId}`;
  }

  // TODO: Replace with your actual storage provider implementation
  const baseUrl = process.env.STORAGE_URL || 'https://storage.drandee.app';
  const token = crypto.randomBytes(32).toString('hex');
  
  return `${baseUrl}/upload/${storageKey}?token=${token}&expires=${Date.now() + 3600000}`;
}

// ═════════════════════════════════════════════════════════
// HELPER: Get public URL (placeholder)
// ═════════════════════════════════════════════════════════

async function getPublicUrl(storageKey) {
  // TODO: Replace with your actual CDN URL
  const cdnUrl = process.env.CDN_URL || 'https://cdn.drandee.app';
  return `${cdnUrl}/${storageKey}`;
}

// ═════════════════════════════════════════════════════════
// ERROR HANDLING MIDDLEWARE
// ═════════════════════════════════════════════════════════

router.use((err, req, res, next) => {
  console.error('Upload route error:', err);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : err.message
    }
  });
});

  return router;
};