const express = require("express");
const authMiddleware = require("../middleware/auth");
const crypto = require("crypto");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_INTEGRATION_REQUESTS_PER_MINUTE: 30,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_INTEGRATION_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const formatConnection = (row) => ({
    id: row.id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    connected: row.connected,
    createdAt: row.created_at,
    lastSyncedAt: row.last_synced_at,
  });

  const formatApiKey = (row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  });

  /*
   * GET /api/integrations - Get all connected integrations
   */
  router.get("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          provider,
          provider_user_id,
          connected,
          created_at,
          last_synced_at
         FROM social_connections
         WHERE user_id = $1`,
        [userId]
      );

      return res.json({
        success: true,
        connections: result.rows.map(formatConnection),
      });
    } catch (err) {
      console.error("Get integrations error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/integrations/:provider - Get specific provider connection
   */
  router.get("/:provider", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const provider = req.params.provider;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          provider,
          provider_user_id,
          connected,
          created_at,
          last_synced_at
         FROM social_connections
         WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          connection: null,
        });
      }

      return res.json({
        success: true,
        connection: formatConnection(result.rows[0]),
      });
    } catch (err) {
      console.error("Get integration error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/integrations/:provider/connect - Connect social account
   */
  router.post("/:provider/connect", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const provider = req.params.provider;
      const { providerUserId, accessToken, refreshToken } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!providerUserId) {
        return res.status(400).json({
          success: false,
          error: "providerUserId required",
        });
      }

      const validProviders = ["google", "twitter", "instagram", "facebook", "youtube", "tiktok"];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({
          success: false,
          error: "Invalid provider",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO social_connections (
          user_id,
          provider,
          provider_user_id,
          access_token,
          refresh_token,
          connected,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          provider_user_id = EXCLUDED.provider_user_id,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          connected = TRUE,
          last_synced_at = NOW()
        RETURNING *`,
        [userId, provider, providerUserId, accessToken || null, refreshToken || null]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        connection: formatConnection(result.rows[0]),
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Connect integration rollback error:", rollbackError.message);
      }
      console.error("Connect integration error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * DELETE /api/integrations/:provider - Disconnect social account
   */
  router.delete("/:provider", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const provider = req.params.provider;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `UPDATE social_connections
         SET
           connected = FALSE,
           access_token = NULL,
           refresh_token = NULL,
           disconnected_at = NOW()
         WHERE user_id = $1 AND provider = $2
         RETURNING *`,
        [userId, provider]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Connection not found",
        });
      }

      return res.json({
        success: true,
        message: "Disconnected",
      });
    } catch (err) {
      console.error("Disconnect integration error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/integrations/share - Share to connected platforms
   */
  router.post("/share", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { postId, platforms, message } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!postId || !platforms || !Array.isArray(platforms)) {
        return res.status(400).json({
          success: false,
          error: "postId and platforms array required",
        });
      }

      await client.query("BEGIN");

      const postCheck = await client.query(
        `SELECT id FROM posts WHERE id = $1 AND user_id = $2`,
        [postId, userId]
      );

      if (postCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      const shares = [];

      for (const platform of platforms) {
        const connection = await client.query(
          `SELECT * FROM social_connections
           WHERE user_id = $1 AND provider = $2 AND connected = TRUE`,
          [userId, platform]
        );

        if (connection.rows.length > 0) {
          // In production, actually share to platform here
          // For now, just record the share intent
          await client.query(
            `INSERT INTO external_shares (
              user_id,
              post_id,
              platform,
              status,
              created_at
            )
            VALUES ($1, $2, $3, 'pending', NOW())`,
            [userId, postId, platform]
          );

          shares.push({
            platform,
            status: "queued",
          });
        } else {
          shares.push({
            platform,
            status: "not_connected",
          });
        }
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        shares,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Share rollback error:", rollbackError.message);
      }
      console.error("Share error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/integrations/import-contacts - Import contacts from social
   */
  router.post("/import-contacts", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { provider } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!provider) {
        return res.status(400).json({
          success: false,
          error: "provider required",
        });
      }

      // Check if connected
      const connection = await pool.query(
        `SELECT * FROM social_connections
         WHERE user_id = $1 AND provider = $2 AND connected = TRUE`,
        [userId, provider]
      );

      if (connection.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Not connected to this provider",
        });
      }

      // In production, fetch contacts from provider API here
      // For now, return placeholder
      return res.json({
        success: true,
        contacts: [],
        message: "Contact import not implemented for this provider",
      });
    } catch (err) {
      console.error("Import contacts error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/integrations/api-keys - Get API keys
   */
  router.get("/api-keys", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          name,
          key_prefix,
          scopes,
          created_at,
          expires_at
         FROM api_keys
         WHERE user_id = $1 AND revoked = FALSE
         ORDER BY created_at DESC`,
        [userId]
      );

      return res.json({
        success: true,
        keys: result.rows.map(formatApiKey),
      });
    } catch (err) {
      console.error("Get API keys error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/integrations/api-keys - Generate new API key
   */
  router.post("/api-keys", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { name, scopes, expires } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: "name required",
        });
      }

      const apiKey = `sk_${crypto.randomBytes(24).toString("hex")}`;
      const keyPrefix = apiKey.slice(0, 8);

      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO api_keys (
          user_id,
          name,
          key_hash,
          key_prefix,
          scopes,
          expires_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, name, key_prefix, scopes, created_at, expires_at`,
        [
          userId,
          name,
          crypto.createHash("sha256").update(apiKey).digest("hex"),
          keyPrefix,
          JSON.stringify(scopes || ["read"]),
          expires ? new Date(expires).toISOString() : null,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        key: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          keyPrefix: result.rows[0].key_prefix,
          scopes: result.rows[0].scopes,
          createdAt: result.rows[0].created_at,
          expiresAt: result.rows[0].expires_at,
        },
        apiKey, // Only shown once!
        warning: "Store this API key securely. It won't be shown again.",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("API key rollback error:", rollbackError.message);
      }
      console.error("Create API key error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * DELETE /api/integrations/api-keys/:id - Revoke API key
   */
  router.delete("/api-keys/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const keyId = parseInt(req.params.id, 10);

      if (!Number.isInteger(keyId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid key ID",
        });
      }

      const result = await pool.query(
        `UPDATE api_keys
         SET
           revoked = TRUE,
           revoked_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [keyId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "API key not found",
        });
      }

      return res.json({
        success: true,
        message: "API key revoked",
      });
    } catch (err) {
      console.error("Revoke API key error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/integrations/webhooks - Register webhook
   */
  router.post("/webhooks", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { url, events, secret } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!url || !events || !Array.isArray(events)) {
        return res.status(400).json({
          success: false,
          error: "url and events array required",
        });
      }

      const result = await pool.query(
        `INSERT INTO webhooks (
          user_id,
          url,
          events,
          secret,
          active,
          created_at
        )
        VALUES ($1, $2, $3, $4, TRUE, NOW())
        RETURNING id, url, events, active, created_at`,
        [userId, url, JSON.stringify(events), secret || crypto.randomBytes(24).toString("hex")]
      );

      return res.status(201).json({
        success: true,
        webhook: {
          id: result.rows[0].id,
          url: result.rows[0].url,
          events: JSON.parse(result.rows[0].events),
          active: result.rows[0].active,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      console.error("Register webhook error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/integrations/webhooks - Get registered webhooks
   */
  router.get("/webhooks", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      const result = await pool.query(
        `SELECT
          id,
          url,
          events,
          active,
          created_at
         FROM webhooks
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return res.json({
        success: true,
        webhooks: result.rows.map((row) => ({
          id: row.id,
          url: row.url,
          events: JSON.parse(row.events),
          active: row.active,
          createdAt: row.created_at,
        })),
      });
    } catch (err) {
      console.error("Get webhooks error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * DELETE /api/integrations/webhooks/:id - Delete webhook
   */
  router.delete("/webhooks/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const webhookId = parseInt(req.params.id, 10);

      if (!Number.isInteger(webhookId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid webhook ID",
        });
      }

      const result = await pool.query(
        `DELETE FROM webhooks
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [webhookId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Webhook not found",
        });
      }

      return res.json({
        success: true,
        webhookId,
      });
    } catch (err) {
      console.error("Delete webhook error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};