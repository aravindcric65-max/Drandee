const express = require("express");
const authMiddleware = require("../middleware/auth");
const { sendNotification } = require("../utils/notify");
const { normalizeMediaUrl } = require("../utils/mediaUrl");

const router = express.Router();

module.exports = (pool, velocityTracker = null) => {
  /*
   * GET /api/user/profile
   * Own profile
   */
  router.get("/profile", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.username,
          u.email,
          u.bio,
          u.profile_pic,
          u.gender,
          u.niche,
          u.birthday,
          u.phone,
          u.frame_style,
          u.city,
          u.state,
          u.country,
          u.role,
          u.is_protected,
          u.current_badge,
          u.joined_since,
          u.star_friends,
          u.identity_level,
          u.current_streak,
          u.avg_dopamine_score,
          u.current_velocity_score,
          u.peak_velocity_24h,
          u.avg_velocity_7d,
          u.total_watch_time,
          u.profile_theme,
          u.tier,
          u.is_verified,
          u.featured_posts,
          u.custom_badges,
          u.onboarding_completed,
          u.interests,

          (
            SELECT COUNT(*)
            FROM follows f
            WHERE f.following_id = u.id
          ) AS followers_count,

          (
            SELECT COUNT(*)
            FROM follows f
            WHERE f.follower_id = u.id
          ) AS following_count,

          (
            SELECT COALESCE(SUM(p.total_respects), 0)
            FROM posts p
            WHERE COALESCE(p.user_id, p.creator_id) = u.id AND p.is_deleted = false
          ) AS total_respects

        FROM users u
        WHERE u.id = $1
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const userRow = result.rows[0];

      let realTimeVelocity = null;

      if (
        velocityTracker &&
        typeof velocityTracker.calculateVelocity === "function"
      ) {
        realTimeVelocity =
          velocityTracker.calculateVelocity(userId);
      }

      return res.json({
        success: true,
        user: formatUser(userRow),
        velocity: realTimeVelocity,
      });
    } catch (err) {
      console.error("GET /profile error:", err);
      return res.status(500).json({
        error: "Server error",
      });
    }
  });

  // POST /onboarding
  router.post("/onboarding", authMiddleware, async (req, res) => {
    const userId = req.auth.userId;
    let { username, interests } = req.body;
    
    try {
      if (username) {
        username = username.trim().toLowerCase();
        
        if (username.length < 3 || username.length > 20) {
          return res.status(400).json({ code: "INVALID_USERNAME", message: "Username must be between 3 and 20 characters." });
        }
        
        if (!/^[a-z0-9_]+$/.test(username)) {
          return res.status(400).json({ code: "INVALID_USERNAME", message: "Username can only contain letters, numbers, and underscores." });
        }
        
        const check = await pool.query("SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2", [username, userId]);
        if (check.rows.length > 0) {
          return res.status(409).json({ code: "USERNAME_TAKEN", message: "That username is already taken." });
        }
      }
      
      const updateFields = [];
      const values = [];
      let valIdx = 1;
      
      if (username) {
        updateFields.push(`username = $${valIdx++}`);
        values.push(username);
      }
      if (interests !== undefined) {
        if (Array.isArray(interests)) {
          updateFields.push(`interests = $${valIdx++}::jsonb`);
          values.push(JSON.stringify(interests));
        }
        updateFields.push(`onboarding_completed = true`);
      }
      
      values.push(userId);
      
      if (updateFields.length > 0) {
        await pool.query(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${valIdx}`,
          values
        );
      }
      
      const updated = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      return res.json({ success: true, user: formatUser(updated.rows[0]) });
      
    } catch (err) {
      if (err.code === '23505') { 
        return res.status(409).json({ code: "USERNAME_TAKEN", message: "That username is already taken." });
      }
      console.error("POST /onboarding error:", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // GET /check-username
  router.get("/check-username", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      let { username } = req.query;
      if (!username) return res.json({ available: false });
      
      username = username.trim().toLowerCase();
      if (username.length < 3 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
        return res.json({ available: false });
      }
      
      const check = await pool.query("SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2", [username, userId]);
      return res.json({ available: check.rows.length === 0 });
    } catch (err) {
      return res.status(500).json({ available: false });
    }
  });

  /*
   * GET /api/user/saved-posts
   * Fetch all saved non-video posts for the authenticated user
   */
  
  /*
   * GET /api/user/respected-posts
   */
  router.get("/respected-posts", authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.caption, p.image_url AS "imageUrl", p.video_url AS "videoUrl", p.content_type AS "contentType", p.type, p.total_respects AS "totalRespects", p.comment_count AS "comments", p.created_at AS "createdAt", u.username AS "creatorUsername", u.name AS "creatorName", u.profile_pic AS "creatorProfilePic"
        FROM respects r
        JOIN posts p ON r.post_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE r.user_id = $1 AND p.is_deleted = false AND (COALESCE(p.type, '') != 'video' AND COALESCE(p.content_type, '') != 'video' AND p.video_url IS NULL)
        ORDER BY r.created_at DESC LIMIT 50`,
        [req.auth.userId]
      );
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
  });

  /*
   * GET /api/user/respected-videos
   */
  router.get("/respected-videos", authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.caption, p.image_url AS "imageUrl", p.video_url AS "videoUrl", p.content_type AS "contentType", p.type, p.total_respects AS "totalRespects", p.comment_count AS "comments", p.created_at AS "createdAt", u.username AS "creatorUsername", u.name AS "creatorName", u.profile_pic AS "creatorProfilePic"
        FROM respects r
        JOIN posts p ON r.post_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE r.user_id = $1 AND p.is_deleted = false AND (p.type = 'video' OR p.content_type = 'video' OR p.video_url IS NOT NULL)
        ORDER BY r.created_at DESC LIMIT 50`,
        [req.auth.userId]
      );
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
  });

  /*
   * GET /api/user/commented-posts
   */
  router.get("/commented-posts", authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT p.id, p.caption, p.image_url AS "imageUrl", p.video_url AS "videoUrl", p.content_type AS "contentType", p.type, p.total_respects AS "totalRespects", p.comment_count AS "comments", p.created_at AS "createdAt", u.username AS "creatorUsername", u.name AS "creatorName", u.profile_pic AS "creatorProfilePic"
        FROM comments c
        JOIN posts p ON c.post_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE c.user_id = $1 AND p.is_deleted = false AND (COALESCE(p.type, '') != 'video' AND COALESCE(p.content_type, '') != 'video' AND p.video_url IS NULL)
        LIMIT 50`,
        [req.auth.userId]
      );
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
  });

  /*
   * GET /api/user/commented-videos
   */
  router.get("/commented-videos", authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT p.id, p.caption, p.image_url AS "imageUrl", p.video_url AS "videoUrl", p.content_type AS "contentType", p.type, p.total_respects AS "totalRespects", p.comment_count AS "comments", p.created_at AS "createdAt", u.username AS "creatorUsername", u.name AS "creatorName", u.profile_pic AS "creatorProfilePic"
        FROM comments c
        JOIN posts p ON c.post_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE c.user_id = $1 AND p.is_deleted = false AND (p.type = 'video' OR p.content_type = 'video' OR p.video_url IS NOT NULL)
        LIMIT 50`,
        [req.auth.userId]
      );
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
  });

  router.get("/saved-posts", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      const result = await pool.query(
        `SELECT 
          p.id,
          p.caption,
          p.image_url AS "imageUrl",
          p.video_url AS "videoUrl",
          p.content_type AS "contentType",
          p.type,
          p.total_respects AS "totalRespects",
          p.comment_count AS "comments",
          p.created_at AS "createdAt",
          u.username AS "creatorUsername",
          u.name AS "creatorName",
          u.profile_pic AS "creatorProfilePic",
          sp.created_at AS "savedAt"
        FROM saved_posts sp
        JOIN posts p ON sp.post_id = p.id
        JOIN users u ON COALESCE(p.user_id, p.creator_id) = u.id
        WHERE sp.user_id = $1 
          AND p.is_deleted = false 
          AND (p.content_type IS NULL OR p.content_type != 'video')
          AND (p.type IS NULL OR p.type != 'video')
        ORDER BY sp.created_at DESC`,
        [userId]
      );

      return res.json({
        success: true,
        data: result.rows
      });
    } catch (err) {
      console.error("GET /saved-posts error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch saved posts"
      });
    }
  });

  /*
   * GET /api/user/saved-videos
   * Fetch all saved video posts for the authenticated user
   */
  router.get("/saved-videos", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      // All saves are stored in saved_posts (has post_id + collection_name).
      // saved_reels uses reel_id (legacy column, no post_id) so we do not query it.
      const result = await pool.query(
        `SELECT 
          p.id,
          p.caption,
          p.video_url AS "videoUrl",
          p.image_url AS "imageUrl",
          p.content_type AS "contentType",
          p.type,
          p.total_respects AS "totalRespects",
          p.comment_count AS "comments",
          p.created_at AS "createdAt",
          u.username AS "creatorUsername",
          u.name AS "creatorName",
          u.profile_pic AS "creatorProfilePic",
          sp.created_at AS "savedAt",
          sp.collection_name AS "collectionName"
        FROM saved_posts sp
        JOIN posts p ON sp.post_id = p.id
        JOIN users u ON COALESCE(p.user_id, p.creator_id) = u.id
        WHERE sp.user_id = $1 
          AND p.is_deleted = false 
          AND (p.content_type = 'video' OR p.type = 'video'
               OR p.video_url IS NOT NULL)
        ORDER BY sp.created_at DESC`,
        [userId]
      );

      return res.json({
        success: true,
        data: result.rows
      });
    } catch (err) {
      console.error("GET /saved-videos error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch saved videos"
      });
    }
  });


  /*
   * GET /api/user/:id
   * Public profile
   */
  router.get("/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      // If a block exists in either direction return minimal not-found response
      let requesterId = req.auth?.userId;
      if (!requesterId && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        try {
          const token = req.headers.authorization.split(" ")[1];
          const { getAuth } = require("../config/firebase");
          const decoded = await getAuth().verifyIdToken(token);
          if (decoded && decoded.uid) {
            const uRes = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1", [decoded.uid]);
            if (uRes.rows.length > 0) requesterId = uRes.rows[0].id;
          }
        } catch (_) {}
      }

      if (requesterId && requesterId !== userId) {
        const blockCheck = await pool.query(
          `SELECT 1 FROM user_blocks 
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)
           LIMIT 1`,
          [requesterId, userId]
        );
        if (blockCheck.rows.length > 0) {
          return res.status(404).json({ success: false, error: "User not found" });
        }
      }

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.username,
          u.bio,
          u.profile_pic,
          u.gender,
          u.niche,
          u.frame_style,
          u.role,
          u.current_badge,
          u.joined_since,
          u.star_friends,
          u.identity_level,
          u.profile_theme,
          u.tier,
          u.is_verified,
          u.featured_posts,
          u.custom_badges,

          (
            SELECT COUNT(*)
            FROM follows f
            WHERE f.following_id = u.id
          ) AS followers_count,

          (
            SELECT COUNT(*)
            FROM follows f
            WHERE f.follower_id = u.id
          ) AS following_count,

          (
            SELECT COALESCE(SUM(p.total_respects), 0)
            FROM posts p
            WHERE COALESCE(p.user_id, p.creator_id) = u.id AND p.is_deleted = false
          ) AS total_respects

        FROM users u
        WHERE u.id = $1
          AND u.account_status != 'BANNED'
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      return res.json({
        success: true,
        user: formatUser(result.rows[0]),
      });
    } catch (err) {
      console.error("GET /:id error:", err);
      return res.status(500).json({
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/user/follow/:id
   */
  router.post("/follow/:id", authMiddleware, async (req, res) => {
    try {
      const followerId = req.auth.userId;
      const followingId = parseInt(req.params.id, 10);

      if (!Number.isInteger(followingId)) {
        return res.status(400).json({
          error: "Invalid target user ID",
        });
      }

      if (String(followerId) === String(followingId)) {
        return res.status(400).json({
          error: "Cannot follow yourself",
        });
      }

      const targetUser = await pool.query(
        `
        SELECT id
        FROM users
        WHERE id = $1
        `,
        [followingId]
      );

      if (targetUser.rows.length === 0) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const inserted = await pool.query(
        `
        INSERT INTO follows (follower_id, following_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING follower_id, following_id
        `,
        [followerId, followingId]
      );

      if (
        inserted.rows.length > 0 &&
        velocityTracker &&
        typeof velocityTracker.trackAction === "function"
      ) {
        await velocityTracker.trackAction(followerId, "follow", {
          targetUserId: followingId,
        });
      }

      if (inserted.rows.length > 0) {
        await sendNotification({
          userId: followingId,
          actorId: followerId,
          type: 'follow',
          title: 'New Follower',
          message: 'started following you'
        });
      }

      const counts = await getFollowCounts(
        pool,
        followingId
      );

      let velocity = null;

      if (
        velocityTracker &&
        typeof velocityTracker.calculateVelocity === "function"
      ) {
        velocity =
          velocityTracker.calculateVelocity(followerId);
      }

      return res.json({
        success: true,
        following: inserted.rows.length > 0,
        ...counts,
        velocity,
      });
    } catch (err) {
      console.error("Follow error:", err);
      return res.status(500).json({
        error: "Server error",
      });
    }
  });

  /*
   * DELETE /api/user/follow/:id
   */
  router.delete("/follow/:id", authMiddleware, async (req, res) => {
    try {
      const followerId = req.auth.userId;
      const followingId = parseInt(req.params.id, 10);

      if (!Number.isInteger(followingId)) {
        return res.status(400).json({
          error: "Invalid target user ID",
        });
      }

      await pool.query(
        `
        DELETE FROM follows
        WHERE follower_id = $1
          AND following_id = $2
        `,
        [followerId, followingId]
      );

      const counts = await getFollowCounts(
        pool,
        followingId
      );

      return res.json({
        success: true,
        following: false,
        ...counts,
      });
    } catch (err) {
      console.error("Unfollow error:", err);
      return res.status(500).json({
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/user/mute/:creatorId
   */
  router.post("/mute/:creatorId", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
      const mutedId = parseInt(req.params.creatorId, 10);
      if (!Number.isInteger(mutedId)) return res.status(400).json({ success: false, error: "Invalid creator ID" });
      if (userId === mutedId) return res.status(400).json({ success: false, error: "Cannot mute yourself" });

      const existing = await pool.query(
        `SELECT id FROM user_mutes WHERE user_id = $1 AND muted_id = $2`,
        [userId, mutedId]
      );

      let muted;
      if (existing.rows.length > 0) {
        await pool.query(`DELETE FROM user_mutes WHERE user_id = $1 AND muted_id = $2`, [userId, mutedId]);
        muted = false;
      } else {
        await pool.query(
          `INSERT INTO user_mutes (user_id, muted_id, created_at) VALUES ($1, $2, NOW())
           ON CONFLICT (user_id, muted_id) DO NOTHING`,
          [userId, mutedId]
        );
        muted = true;
      }

      return res.json({ success: true, muted });
    } catch (err) {
      console.error("User mute error:", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * GET /api/user/:id/followers
   */
  router.get("/:id/followers", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      const limit = getLimit(req.query.limit);
      const offset = getOffset(req.query.offset);

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.username,
          u.profile_pic AS "profilePic"
        FROM follows f
        INNER JOIN users u
          ON u.id = f.follower_id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [userId, limit, offset]
      );

      return res.json({
        success: true,
        followers: result.rows,
        pagination: {
          limit,
          offset,
          count: result.rows.length,
        },
      });
    } catch (err) {
      console.error("Followers list error:", err);
      return res.status(500).json({
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/user/:id/following
   */
  router.get("/:id/following", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      const limit = getLimit(req.query.limit);
      const offset = getOffset(req.query.offset);

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.username,
          u.profile_pic AS "profilePic"
        FROM follows f
        INNER JOIN users u
          ON u.id = f.following_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [userId, limit, offset]
      );

      return res.json({
        success: true,
        following: result.rows,
        pagination: {
          limit,
          offset,
          count: result.rows.length,
        },
      });
    } catch (err) {
      console.error("Following list error:", err);
      return res.status(500).json({
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/user/:id/posts
   */
  router.get("/:id/posts", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "Invalid user ID",
        });
      }

      const result = await pool.query(
        `
        SELECT
          p.id,
          COALESCE(p.user_id, p.creator_id) AS "creatorId",
          p.creator_name AS "creatorName",
          p.video_url AS "videoUrl",
          p.image_url AS "imageUrl",
          p.caption,
          p.tags,
          p.type,
          p.total_respects AS "totalRespects",
          p.comment_count AS "comments",
          p.share_count AS "shares",
          p.save_count AS "saves",
          p.watch_count AS "watchCount",
          p.avg_completion_rate AS "avgCompletionRate",
          p.region,
          p.created_at AS "createdAt"
        FROM posts p
        WHERE COALESCE(p.user_id, p.creator_id) = $1 AND p.is_deleted = false
        ORDER BY p.created_at DESC
        `,
        [userId]
      );

      return res.json({
        success: true,
        posts: result.rows,
      });
    } catch (err) {
      console.error("User posts error:", err);
      return res.status(500).json({
        error: "Server error",
      });
    }
  });

  /*
   * Helpers
   */
  async function getFollowCounts(poolInstance, userId) {
    const result = await poolInstance.query(
      `
      SELECT
        (
          SELECT COUNT(*)
          FROM follows
          WHERE following_id = $1
        ) AS followers_count,

        (
          SELECT COUNT(*)
          FROM follows
          WHERE follower_id = $1
        ) AS following_count
      `,
      [userId]
    );

    const row = result.rows[0] || {};

    return {
      followersCount: Number(row.followers_count) || 0,
      followingCount: Number(row.following_count) || 0,
    };
  }

  function getLimit(value) {
    const parsed = parseInt(value, 10) || 50;
    return Math.min(Math.max(parsed, 1), 100);
  }

  function getOffset(value) {
    const parsed = parseInt(value, 10) || 0;
    return Math.max(parsed, 0);
  }

  function parseJsonArray(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return value ? [value] : [];
      }
    }

    return [];
  }

  function formatUser(u) {
    return {
      id: u.id,
      name: u.name || "",
      username: u.username || "",
      email: u.email || "",
      bio: u.bio || "",
      profilePic: normalizeMediaUrl(u.profile_pic),
      gender: u.gender || "",
      niche: parseJsonArray(u.niche),
      birthday: u.birthday || null,
      phone: u.phone || "",
      frameStyle: u.frame_style || "gradient",
      city: u.city || "",
      state: u.state || "",
      country: u.country || "",
      role: u.role || "audience",
      isProtected: Boolean(u.is_protected),
      currentBadge: u.current_badge || null,
      joinedSince: u.joined_since || null,
      starFriends: parseJsonArray(u.star_friends),
      profileTheme: u.profile_theme || 'dark',
      tier: u.tier || 'free',
      isVerified: Boolean(u.is_verified),
      featuredPosts: parseJsonArray(u.featured_posts),
      customBadges: parseJsonArray(u.custom_badges),

      followersCount: Number(u.followers_count) || 0,
      followingCount: Number(u.following_count) || 0,
      totalRespects: Number(u.total_respects) || 0,

      identityLevel: u.identity_level || "Emerging",
      currentStreak: Number(u.current_streak) || 0,

      avgDopamineScore: Number(
        u.avg_dopamine_score || 0
      ).toFixed(1),

      currentVelocityScore: Number(
        u.current_velocity_score || 0
      ).toFixed(2),

      peakVelocity24h: Number(
        u.peak_velocity_24h || 0
      ).toFixed(2),

      avgVelocity7d: Number(
        u.avg_velocity_7d || 0
      ).toFixed(2),

      totalWatchTime: Number(
        u.total_watch_time || 0
      ),
      onboardingCompleted: Boolean(u.onboarding_completed),
      interests: parseJsonArray(u.interests)
    };
  }

  /*
   * GET /api/user/username/:username — fetch public profile by username
   * Used by /u/:username clean URLs
   */
  router.get("/username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ success: false, error: "Username required" });
      }

      // Optionally determine requester for block-check (best-effort, no hard fail if no auth)
      let requesterId = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const { getAuth } = require("../config/firebase");
          const decoded = await getAuth().verifyIdToken(authHeader.split(" ")[1]);
          if (decoded?.uid) {
            const uRes = await pool.query("SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1", [decoded.uid]);
            if (uRes.rows.length > 0) requesterId = uRes.rows[0].id;
          }
        }
      } catch (_) { /* non-authed request — continue */ }

      // Block check
      if (requesterId) {
        const blockCheck = await pool.query(
          `SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = (SELECT id FROM users WHERE LOWER(username) = LOWER($2) LIMIT 1)) OR (blocker_id = (SELECT id FROM users WHERE LOWER(username) = LOWER($2) LIMIT 1) AND blocked_id = $1) LIMIT 1`,
          [requesterId, username]
        );
        if (blockCheck.rows.length > 0) {
          return res.status(404).json({ success: false, error: "User not found" });
        }
      }

      const result = await pool.query(
        `SELECT u.*,
           (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count,
           (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count,
           (SELECT COALESCE(SUM(p.total_respects),0) FROM posts p WHERE COALESCE(p.user_id, p.creator_id) = u.id AND p.is_deleted = false) AS total_respects
         FROM users u
         WHERE LOWER(u.username) = LOWER($1) AND u.account_status != 'BANNED'
         LIMIT 1`,
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      return res.json({ success: true, user: formatUser(result.rows[0]) });
    } catch (err) {
      console.error("GET /user/username/:username error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  return router;
};