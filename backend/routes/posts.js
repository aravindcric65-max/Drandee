const express = require("express");
const authMiddleware = require("../middleware/auth");
const { createPost, getPostById, getPostsByCreator } = require("../models/postModel");
const { createPrivacyAudit } = require("../middleware/audit");

const ALLOWED_REGIONS = new Set([
  "local",
  "state",
  "national",
  "global",
]);

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

module.exports = (pool) => {
  const router = express.Router();

  router.post("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const {
        videoUrl,
        caption,
        tags,
        overlayText,
        textPosition,
        startTime,
        endTime,
        region,
      } = req.body;

      if (!videoUrl || typeof videoUrl !== "string") {
        return res.status(400).json({
          success: false,
          error: "videoUrl is required",
        });
      }

      if (!isValidHttpUrl(videoUrl.trim())) {
        return res.status(400).json({
          success: false,
          error: "videoUrl must be a valid http or https URL",
        });
      }

      const safeRegion = ALLOWED_REGIONS.has(region)
        ? region
        : "local";

      const safeCaption =
        typeof caption === "string"
          ? caption.trim().slice(0, 2000)
          : null;

      const userResult = await pool.query(
        "SELECT name FROM users WHERE id = $1",
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const post = await createPost(pool, {
        creatorId: userId,
        creatorName: userResult.rows[0].name,
        videoUrl: videoUrl.trim(),
        caption: safeCaption,
        tags: Array.isArray(tags) ? tags : [],
        overlayText,
        textPosition,
        startTime,
        endTime,
        region: safeRegion,
      });

      return res.status(201).json({ success: true, post });
    } catch (err) {
      console.error("Create post error:", err.message);

      return res.status(500).json({
        success: false,
        error: "Failed to create post",
      });
    }
  });

  router.get("/:id", authMiddleware, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);

      if (!Number.isInteger(postId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid post ID",
        });
      }

      const post = await getPostById(pool, postId, req.auth.userId);

      if (!post) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      return res.json({ success: true, post });
    } catch (err) {
      console.error("Get post error:", err.message);

      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  router.get("/user/:userId", authMiddleware, async (req, res) => {
    try {
      const creatorId = parseInt(req.params.userId, 10);
      const limit = parseInt(req.query.limit, 10) || 20;

      if (!Number.isInteger(creatorId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      // If a block exists in either direction return minimal not-found response
      if (req.auth.userId && req.auth.userId !== creatorId) {
        const blockCheck = await pool.query(
          `SELECT 1 FROM user_blocks 
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)
           LIMIT 1`,
          [req.auth.userId, creatorId]
        );
        if (blockCheck.rows.length > 0) {
          return res.status(404).json({ success: false, error: "User not found" });
        }
      }

      const posts = await getPostsByCreator(pool, creatorId, req.auth.userId, limit);
      
      return res.json({ success: true, posts });
    } catch (err) {
      console.error("Get posts by creator error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  router.put("/:id/privacy", authMiddleware, createPrivacyAudit('privacy_update'), async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;

      // Validate post ID
      if (!Number.isInteger(postId) || postId <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid post ID. Must be a positive integer." 
        });
      }

      const { hideRespectCount, hideShareCount, commentsEnabled, reuseEnabled, contentType } = req.body;
      
      // Validate request body structure
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ 
          success: false, 
          error: "Request body must be a JSON object with privacy settings" 
        });
      }

      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      // Validate and collect boolean fields
      if (typeof hideRespectCount === "boolean") {
        updateFields.push(`hide_respect_count = $${paramCount++}`);
        updateValues.push(hideRespectCount);
      } else if (hideRespectCount !== undefined) {
        return res.status(400).json({ 
          success: false, 
          error: "hideRespectCount must be a boolean value (true/false)" 
        });
      }

      if (typeof hideShareCount === "boolean") {
        updateFields.push(`hide_share_count = $${paramCount++}`);
        updateValues.push(hideShareCount);
      } else if (hideShareCount !== undefined) {
        return res.status(400).json({ 
          success: false, 
          error: "hideShareCount must be a boolean value (true/false)" 
        });
      }

      if (typeof commentsEnabled === "boolean") {
        updateFields.push(`comments_enabled = $${paramCount++}`);
        updateValues.push(commentsEnabled);
      } else if (commentsEnabled !== undefined) {
        return res.status(400).json({ 
          success: false, 
          error: "commentsEnabled must be a boolean value (true/false)" 
        });
      }

      if (typeof reuseEnabled === "boolean") {
        updateFields.push(`reuse_enabled = $${paramCount++}`);
        updateValues.push(reuseEnabled);
      } else if (reuseEnabled !== undefined) {
        return res.status(400).json({ 
          success: false, 
          error: "reuseEnabled must be a boolean value (true/false)" 
        });
      }

      // Validate and collect content_type if provided
      if (contentType !== undefined) {
        const validContentTypes = ['photo', 'video', 'text'];
        if (validContentTypes.includes(contentType)) {
          updateFields.push(`content_type = $${paramCount++}`);
          updateValues.push(contentType);
        } else {
          return res.status(400).json({ 
            success: false, 
            error: `contentType must be one of: ${validContentTypes.join(', ')}` 
          });
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "No valid privacy fields provided. Supported fields: hideRespectCount, hideShareCount, commentsEnabled, reuseEnabled, contentType" 
        });
      }

      updateValues.push(postId);
      updateValues.push(userId);

      const query = `
        UPDATE posts 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramCount} AND (user_id = $${paramCount + 1} OR creator_id = $${paramCount + 1}) AND is_deleted = false 
        RETURNING id, hide_respect_count, hide_share_count, comments_enabled, reuse_enabled, content_type
      `;

      const result = await pool.query(query, updateValues);

      if (result.rowCount === 0) {
        // Detailed error analysis
        const existResult = await pool.query(
          "SELECT user_id, creator_id, is_deleted FROM posts WHERE id = $1 LIMIT 1", 
          [postId]
        );
        
        if (existResult.rowCount === 0) {
          return res.status(404).json({ 
            success: false, 
            error: "Post not found" 
          });
        }
        
        const post = existResult.rows[0];
        if (post.is_deleted) {
          return res.status(404).json({ 
            success: false, 
            error: "Post has been deleted" 
          });
        }
        
        const ownerId = post.user_id || post.creator_id;
        if (String(ownerId) !== String(userId)) {
          return res.status(403).json({ 
            success: false, 
            error: "Forbidden: You do not have permission to modify this post's privacy settings" 
          });
        }
        
        return res.status(400).json({ 
          success: false, 
          error: "Failed to update privacy settings. Database column may not exist." 
        });
      }

      // Return updated post with privacy settings
      const updatedPost = await getPostById(pool, postId, userId);
      if (!updatedPost) {
        return res.status(404).json({ 
          success: false, 
          error: "Post not found after update" 
        });
      }

      return res.json({ 
        success: true, 
        post: updatedPost,
        updatedFields: updateFields.length,
        message: "Privacy settings updated successfully"
      });
    } catch (err) {
      console.error("Update privacy error:", err.message);
      
      // Handle specific database errors
      let errorMessage = "Server error";
      let statusCode = 500;
      
      if (err.message && err.message.includes('column')) {
        errorMessage = "Database column missing. Please run database migration for privacy columns.";
        statusCode = 503;
      } else if (err.message && err.message.includes('permission')) {
        errorMessage = "Database permission denied";
        statusCode = 403;
      } else if (err.message && err.message.includes('connection')) {
        errorMessage = "Database connection failed";
        statusCode = 503;
      }
      
      return res.status(statusCode).json({ 
        success: false, 
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
      });
    }
  });

  router.delete("/:id", authMiddleware, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;

      if (!Number.isInteger(postId)) {
        return res.status(400).json({ success: false, error: "Invalid post ID" });
      }

      // Perform a soft delete, enforcing ownership in the WHERE clause
      const result = await pool.query(
        "UPDATE posts SET is_deleted = true WHERE id = $1 AND (user_id = $2 OR creator_id = $2) AND is_deleted = false RETURNING id",
        [postId, userId]
      );

      if (result.rowCount === 0) {
        const existResult = await pool.query("SELECT user_id, creator_id FROM posts WHERE id = $1 AND is_deleted = false", [postId]);
        if (existResult.rowCount === 0) {
          return res.status(404).json({ success: false, error: "Post not found" });
        }
        
        const ownerId = existResult.rows[0].user_id || existResult.rows[0].creator_id;
        if (String(ownerId) !== String(userId)) {
          return res.status(403).json({ success: false, error: "Forbidden: You do not own this post" });
        }
        
        return res.status(200).json({ success: true, message: "Post already deleted", event: "post_deleted", payload: { postId } });
      }

      return res.status(200).json({ 
        success: true, 
        message: "Post deleted successfully",
        event: "post_deleted",
        payload: { postId, id: postId }
      });
    } catch (err) {
      console.error("Delete post error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  return router;
};
