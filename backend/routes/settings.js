const express = require("express");
const authMiddleware = require("../middleware/auth");
const bcrypt = require("bcrypt");
const { normalizeMediaUrl } = require("../utils/mediaUrl");

const checkForbiddenFields = (body) => {
  const forbidden = ['role', 'account_status', 'firebase_uid', 'is_admin', 'security_flags'];
  return Object.keys(body || {}).some(key => forbidden.includes(key));
};

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_SETTINGS_REQUESTS_PER_MINUTE: 30,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_SETTINGS_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const formatProfile = (row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    profilePic: normalizeMediaUrl(row.profile_pic),
    bio: row.bio,
    city: row.city,
    birthday: row.birthday,
    niche: row.niche,
    isPrivate: row.is_protected,
    isVerified: row.is_verified,
    createdAt: row.created_at,
  });

  /*
   * GET /api/settings/profile - Get current user profile
   */
  router.get("/profile", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const result = await pool.query(
        `SELECT
          id,
          name,
          username,
          email,
          profile_pic,
          bio,
          city,
          birthday,
          niche,
          is_protected,
          is_verified
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      return res.json({
        success: true,
        profile: formatProfile(result.rows[0]),
      });
    } catch (err) {
      console.error("Get profile error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/settings/profile - Update profile (name, bio, avatar)
   */
  router.put("/profile", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      if (checkForbiddenFields(req.body)) {
        return res.status(400).json({ success: false, error: "Validation failed: restricted fields present." });
      }

      const { name, username, bio, profilePic, city, birthday, niche } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }
      
      // Input Validation & Sanitization
      const cleanName = name ? name.substring(0, 50).trim() : undefined;
      const cleanUsername = username ? username.replace(/[^a-zA-Z0-9_.]/g, "").substring(0, 30).trim() : undefined;
      const cleanBio = bio ? bio.substring(0, 150).trim() : undefined;
      const cleanCity = city ? city.substring(0, 50).trim() : undefined;
      const cleanBirthday = birthday ? birthday : undefined; // simple date string
      const cleanNiche = niche ? JSON.stringify([niche]) : undefined; // Store as JSON array

      await client.query("BEGIN");

      // Check username if changed
      if (cleanUsername) {
        const existing = await client.query(
          `SELECT id FROM users WHERE username = $1 AND id != $2`,
          [cleanUsername, userId]
        );
        if (existing.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, error: "Username already taken" });
        }
      }

      const result = await client.query(
        `UPDATE users
         SET
           name = COALESCE($1, name),
           username = COALESCE($2, username),
           bio = COALESCE($3, bio),
           profile_pic = COALESCE($4, profile_pic),
           city = COALESCE($5, city),
           birthday = COALESCE($6, birthday),
           niche = COALESCE($7, niche),
           updated_at = NOW()
         WHERE id = $8
         RETURNING id, name, username, email, profile_pic, bio, city, birthday, niche, is_protected, is_verified`,
        [cleanName, cleanUsername, cleanBio, profilePic, cleanCity, cleanBirthday, cleanNiche, userId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        profile: formatProfile(result.rows[0]),
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Profile update rollback error:", rollbackError.message);
      }
      console.error("Update profile error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * PUT /api/settings/username - Change username
   */
  router.put("/username", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      if (checkForbiddenFields(req.body)) {
        return res.status(400).json({ success: false, error: "Validation failed: restricted fields present." });
      }

      const { username } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!username || username.trim().length < 3 || username.trim().length > 30) {
        return res.status(400).json({
          success: false,
          error: "Username must be 3–30 characters",
        });
      }

      await client.query("BEGIN");

      // Check if username is taken
      const existing = await client.query(
        `SELECT id FROM users WHERE username = $1 AND id != $2`,
        [username.trim(), userId]
      );

      if (existing.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Username already taken",
        });
      }

      const result = await client.query(
        `UPDATE users
         SET
           username = $1,
           updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, username, email, profile_pic, bio, city, is_protected, is_verified, created_at`,
        [username.trim(), userId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        profile: formatProfile(result.rows[0]),
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Username update rollback error:", rollbackError.message);
      }
      console.error("Update username error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/settings/account - Get account info
   */
  router.get("/account", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const result = await pool.query(
        `SELECT
          id,
          name,
          username,
          email,
          phone,
          is_banned,
          is_verified,
          created_at
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      return res.json({
        success: true,
        account: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          username: result.rows[0].username,
          email: result.rows[0].email,
          phone: result.rows[0].phone,
          isBanned: result.rows[0].is_banned,
          isVerified: result.rows[0].is_verified,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      console.error("Get account error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/settings/account - Update account (email, phone)
   */
  router.put("/account", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      if (checkForbiddenFields(req.body)) {
        return res.status(400).json({ success: false, error: "Validation failed: restricted fields present." });
      }

      const { email, phone, currentPassword } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      // SECURITY: If email is being changed, require currentPassword verification
      if (email) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            error: "Current password required to change email",
          });
        }

        // Verify current password before allowing email change
        const userResult = await client.query(
          `SELECT password_hash FROM users WHERE id = $1`,
          [userId]
        );

        if (userResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: "User not found",
          });
        }

        const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

        if (!validPassword) {
          return res.status(401).json({
            success: false,
            error: "Current password is incorrect",
          });
        }
      }

      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE users
         SET
           email = COALESCE($1, email),
           phone = COALESCE($2, phone),
           updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, username, email, phone, is_banned, is_verified, created_at`,
        [email, phone, userId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        account: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          username: result.rows[0].username,
          email: result.rows[0].email,
          phone: result.rows[0].phone,
          isBanned: result.rows[0].is_banned,
          isVerified: result.rows[0].is_verified,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Account update rollback error:", rollbackError.message);
      }
      console.error("Update account error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * PUT /api/settings/password - Change password
   */
  router.put("/password", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      const { currentPassword, newPassword } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "currentPassword and newPassword required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters",
        });
      }

      await client.query("BEGIN");

      const userResult = await client.query(
        `SELECT password_hash FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

      if (!validPassword) {
        await client.query("ROLLBACK");
        return res.status(401).json({
          success: false,
          error: "Current password is incorrect",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await client.query(
        `UPDATE users
         SET
           password_hash = $1,
           updated_at = NOW()
         WHERE id = $2`,
        [hashedPassword, userId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Password update rollback error:", rollbackError.message);
      }
      console.error("Update password error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * DELETE /api/settings/account - Delete account
   */
  router.delete("/account", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      const { password } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          error: "Password required to confirm deletion",
        });
      }

      await client.query("BEGIN");

      const userResult = await client.query(
        `SELECT password_hash FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);

      if (!validPassword) {
        await client.query("ROLLBACK");
        return res.status(401).json({
          success: false,
          error: "Password is incorrect",
        });
      }

      // Soft delete - mark as deleted
      await client.query(
        `UPDATE users
         SET
           is_deleted = TRUE,
           deleted_at = NOW()
         WHERE id = $1`,
        [userId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Account scheduled for deletion (30-day grace period)",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Account deletion rollback error:", rollbackError.message);
      }
      console.error("Delete account error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/settings/privacy - Get privacy settings
   */
  router.get("/privacy", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const result = await pool.query(
        `SELECT
          is_private,
          show_activity_status,
          allow_mentions,
          allow_dms
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      return res.json({
        success: true,
        privacy: {
          isPrivate: result.rows[0].is_private,
          showActivityStatus: result.rows[0].show_activity_status,
          allowMentions: result.rows[0].allow_mentions,
          allowDms: result.rows[0].allow_dms,
        },
      });
    } catch (err) {
      console.error("Get privacy error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/settings/privacy - Update privacy settings
   */
  router.put("/privacy", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      if (checkForbiddenFields(req.body)) {
        return res.status(400).json({ success: false, error: "Validation failed: restricted fields present." });
      }

      const { isPrivate, showActivityStatus, allowMentions, allowDms } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `UPDATE users
         SET
           is_private = COALESCE($1, is_private),
           show_activity_status = COALESCE($2, show_activity_status),
           allow_mentions = COALESCE($3, allow_mentions),
           allow_dms = COALESCE($4, allow_dms),
           updated_at = NOW()
         WHERE id = $5
         RETURNING is_private, show_activity_status, allow_mentions, allow_dms`,
        [isPrivate, showActivityStatus, allowMentions, allowDms, userId]
      );

      return res.json({
        success: true,
        privacy: {
          isPrivate: result.rows[0].is_private,
          showActivityStatus: result.rows[0].show_activity_status,
          allowMentions: result.rows[0].allow_mentions,
          allowDms: result.rows[0].allow_dms,
        },
      });
    } catch (err) {
      console.error("Update privacy error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/settings/notifications - Get notification preferences
   */
  router.get("/notifications", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const result = await pool.query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );

      const prefs = result.rows[0] || {
        push_enabled: true,
        email_enabled: true,
        respect_enabled: true,
        comment_enabled: true,
        follow_enabled: true,
        mention_enabled: true,
        reply_enabled: true,
        system_enabled: true,
      };

      return res.json({
        success: true,
        notifications: {
          push: prefs.push_enabled,
          email: prefs.email_enabled,
          respect: prefs.respect_enabled,
          comment: prefs.comment_enabled,
          follow: prefs.follow_enabled,
          mention: prefs.mention_enabled,
          reply: prefs.reply_enabled,
          system: prefs.system_enabled,
        },
      });
    } catch (err) {
      console.error("Get notifications error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/settings/notifications - Update notification preferences
   */
  router.put("/notifications", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      if (checkForbiddenFields(req.body)) {
        return res.status(400).json({ success: false, error: "Validation failed: restricted fields present." });
      }

      const { push, email, respect, comment, follow, mention, reply, system } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      await pool.query(
        `INSERT INTO notification_preferences (
          user_id,
          push_enabled,
          email_enabled,
          respect_enabled,
          comment_enabled,
          follow_enabled,
          mention_enabled,
          reply_enabled,
          system_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id)
        DO UPDATE SET
          push_enabled = EXCLUDED.push_enabled,
          email_enabled = EXCLUDED.email_enabled,
          respect_enabled = EXCLUDED.respect_enabled,
          comment_enabled = EXCLUDED.comment_enabled,
          follow_enabled = EXCLUDED.follow_enabled,
          mention_enabled = EXCLUDED.mention_enabled,
          reply_enabled = EXCLUDED.reply_enabled,
          system_enabled = EXCLUDED.system_enabled`,
        [
          userId,
          push !== false,
          email !== false,
          respect !== false,
          comment !== false,
          follow !== false,
          mention !== false,
          reply !== false,
          system !== false,
        ]
      );

      return res.json({
        success: true,
        notifications: {
          push: push !== false,
          email: email !== false,
          respect: respect !== false,
          comment: comment !== false,
          follow: follow !== false,
          mention: mention !== false,
          reply: reply !== false,
          system: system !== false,
        },
      });
    } catch (err) {
      console.error("Update notifications error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/settings/preferences - Get app preferences
   */
  router.get("/preferences", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const result = await pool.query(
        `SELECT profile_theme, autoplay_videos, data_saver_mode FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      return res.json({
        success: true,
        preferences: {
          language: "en",
          theme: result.rows[0].profile_theme || "dark",
          autoplayVideos: result.rows[0].autoplay_videos !== false, // default true
          dataSaverMode: result.rows[0].data_saver_mode || false,
        },
      });
    } catch (err) {
      console.error("Get preferences error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * PUT /api/settings/preferences - Update app preferences
   */
  router.put("/preferences", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      if (checkForbiddenFields(req.body)) {
        return res.status(400).json({ success: false, error: "Validation failed: restricted fields present." });
      }

      const { theme, autoplayVideos, dataSaverMode } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
      }

      let profileTheme = theme !== undefined && theme !== null ? String(theme) : null;
      
      const updateResult = await pool.query(
        `UPDATE users 
         SET profile_theme = COALESCE($1, profile_theme),
             autoplay_videos = COALESCE($2, autoplay_videos),
             data_saver_mode = COALESCE($3, data_saver_mode),
             updated_at = NOW() 
         WHERE id = $4 
         RETURNING profile_theme, autoplay_videos, data_saver_mode`,
        [
          profileTheme,
          autoplayVideos !== undefined ? Boolean(autoplayVideos) : null,
          dataSaverMode !== undefined ? Boolean(dataSaverMode) : null,
          userId
        ]
      );

      if (updateResult.rows.length === 0) {
         return res.status(404).json({ success: false, error: "User not found" });
      }

      const row = updateResult.rows[0];

      return res.json({
        success: true,
        preferences: {
          language: "en",
          theme: row.profile_theme || "dark",
          autoplayVideos: row.autoplay_videos !== false,
          dataSaverMode: row.data_saver_mode || false,
        },
      });
    } catch (err) {
      console.error("Update preferences error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * POST /api/settings/2fa/enable - Enable 2FA (placeholder)
   */
  router.post("/2fa/enable", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      // Placeholder - implement with authenticator app
      return res.json({
        success: true,
        message: "2FA setup initiated (placeholder - implement with authenticator app)",
        secret: "PLACEHOLDER_SECRET",
        qrCode: "PLACEHOLDER_QR_CODE_URL",
      });
    } catch (err) {
      console.error("Enable 2FA error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/settings/2fa/disable - Disable 2FA (placeholder)
   */
  router.post("/2fa/disable", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      const { code } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      // Placeholder - implement with authenticator app verification
      return res.json({
        success: true,
        message: "2FA disabled (placeholder - implement with authenticator app)",
      });
    } catch (err) {
      console.error("Disable 2FA error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/settings/2fa/verify - Verify 2FA code (placeholder)
   */
  router.post("/2fa/verify", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      const { code } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      // Placeholder - implement with authenticator app verification
      return res.json({
        success: true,
        message: "2FA code verified (placeholder - implement with authenticator app)",
        verified: true,
      });
    } catch (err) {
      console.error("Verify 2FA error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/settings/providers - Get linked auth providers
   */
  router.get("/providers", authMiddleware, async (req, res) => {
    try {
      const { getAuth } = require('../config/firebase');
      const firebaseUid = req.auth.firebaseUid;
      
      if (!firebaseUid) {
        return res.status(401).json({ success: false, error: "Not authenticated with Firebase" });
      }
      
      const userRecord = await getAuth().getUser(firebaseUid);
      
      const providers = userRecord.providerData.map(p => p.providerId);
      
      return res.json({ success: true, providers });
    } catch (err) {
      console.error("Get providers error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * DELETE /api/settings/providers/:providerId - Unlink a provider
   */
  router.delete("/providers/:providerId", authMiddleware, async (req, res) => {
    try {
      const { checkSecurityLock, recordSecurityAnomaly } = require("../utils/antiBot");
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const isLocked = await checkSecurityLock(userId);
      if (isLocked) {
        return res.status(403).json({ success: false, error: "Sensitive actions temporarily locked due to suspicious activity." });
      }

      const { getAuth } = require('../config/firebase');
      const providerId = req.params.providerId;
      
      const userResult = await pool.query('SELECT firebase_uid FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });

      const firebaseUid = userResult.rows[0].firebase_uid;
      const userRecord = await getAuth().getUser(firebaseUid);
      
      if (userRecord.providerData.length <= 1) {
        await recordSecurityAnomaly(userId, "provider_unlink_abuse");
        return res.status(400).json({ success: false, error: "Cannot remove the only authentication provider." });
      }

      // Ensure the provider they are trying to delete is actually linked to THEIR account
      const hasProvider = userRecord.providerData.some(p => p.providerId === providerId);
      if (!hasProvider) {
         await recordSecurityAnomaly(userId, "provider_unlink_spoof");
         return res.status(400).json({ success: false, error: "Provider not linked to this account." });
      }

      const updatedUser = await getAuth().unlinkProvider(firebaseUid, [providerId]);
      
      await pool.query(
        "INSERT INTO login_history (user_id, provider, status) VALUES ($1, $2, $3)", 
        [userId, providerId, 'UNLINKED']
      );

      return res.json({ success: true, providers: updatedUser.providerData.map(p => p.providerId) });
    } catch (err) {
      console.error("Unlink provider error:", err.message);
      return res.status(500).json({ success: false, error: "Failed to unlink provider" });
    }
  });

  /*
   * POST /api/settings/sessions/revoke - Global Logout / Revoke all sessions
   */
  router.post("/sessions/revoke", authMiddleware, async (req, res) => {
    try {
      const { getAuth } = require('../config/firebase');
      const userId = req.auth.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }
      
      const userResult = await pool.query('SELECT firebase_uid FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
      
      const firebaseUid = userResult.rows[0].firebase_uid;
      
      // Revoke all Firebase refresh tokens for this user
      await getAuth().revokeRefreshTokens(firebaseUid);
      
      // Log the security event
      await pool.query(
        "INSERT INTO login_history (user_id, provider, status) VALUES ($1, $2, $3)", 
        [userId, 'FIREBASE', 'SESSIONS_REVOKED']
      );

      return res.json({ success: true, message: "All sessions revoked successfully" });
    } catch (err) {
      console.error("Session revocation error:", err.message);
      return res.status(500).json({ success: false, error: "Server error during session revocation" });
    }
  });

  return router;
};