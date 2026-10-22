const express = require("express");
const crypto = require("crypto");

module.exports = (pool, redisClient) => {
  const router = express.Router();

  // Rate limiting - prevent abuse (1000 req/min per IP)
  const rateLimits = {
    MAX_WEBHOOK_REQUESTS_PER_MINUTE: 1000,
    ipRequests: new Map(),
  };

  const checkRateLimit = (ip) => {
    const now = Date.now();
    const ipReqs = rateLimits.ipRequests.get(ip) || [];
    const recentReqs = ipReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_WEBHOOK_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.ipRequests.set(ip, recentReqs);
    return true;
  };

  // Idempotency check - prevent duplicate processing
  const checkIdempotency = async (key) => {
    if (!redisClient) {
      return false;
    }

    try {
      const exists = await redisClient.get(`webhook:${key}`);
      if (exists) {
        return true;
      }
      await redisClient.set(`webhook:${key}`, "1", { EX: 3600 });
      return false;
    } catch (err) {
      console.error("Idempotency check error:", err.message);
      return false;
    }
  };

  // Signature verification - HMAC
  const verifySignature = (payload, signature, secret) => {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch (err) {
      return false;
    }
  };

  // Log webhook event
  const logWebhook = async (provider, event, data, status) => {
    try {
      await pool.query(
        `INSERT INTO webhook_logs (
          provider,
          event_type,
          payload,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW())`,
        [provider, event, JSON.stringify(data), status]
      );
    } catch (err) {
      console.error("Webhook log error:", err.message);
    }
  };

  // Async processing helper
  const processAsync = async (fn) => {
    setImmediate(async () => {
      try {
        await fn();
      } catch (err) {
        console.error("Async webhook processing error:", err.message);
      }
    });
  };

  /*
   * POST /api/webhooks/payment - Payment provider callbacks
   */
  router.post("/payment", async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many requests",
      });
    }

    try {
      const provider = req.headers["x-webhook-provider"] || "unknown";
      const signature = req.headers["x-webhook-signature"] || "";
      const payload = JSON.stringify(req.body);
      const event = req.body.type || req.body.event || "payment";

      // Verify signature (if secret configured)
      const secret = process.env.WEBHOOK_PAYMENT_SECRET;
      if (secret && signature) {
        if (!verifySignature(payload, signature, secret)) {
          await logWebhook(provider, event, req.body, "invalid_signature");
          return res.status(401).json({
            success: false,
            error: "Invalid signature",
          });
        }
      }

      // Idempotency check
      const idempotencyKey = req.headers["x-idempotency-key"] || req.body.id;
      if (idempotencyKey) {
        const isDuplicate = await checkIdempotency(`payment:${idempotencyKey}`);
        if (isDuplicate) {
          return res.json({
            success: true,
            message: "Already processed",
          });
        }
      }

      // Process async (don't block response)
      processAsync(async () => {
        if (event === "payment.completed" || event === "charge.succeeded") {
          const { user_id, amount, currency, payment_id } = req.body.data || req.body;

          if (user_id && payment_id) {
            await pool.query(
              `INSERT INTO payments (
                user_id,
                payment_id,
                amount,
                currency,
                status,
                provider,
                created_at
              )
              VALUES ($1, $2, $3, $4, 'completed', $5, NOW())
              ON CONFLICT (payment_id) DO NOTHING`,
              [user_id, payment_id, amount, currency, provider]
            );

            // Update user subscription
            await pool.query(
              `UPDATE users
               SET
                 is_premium = TRUE,
                 premium_expires_at = NOW() + INTERVAL '30 days'
               WHERE id = $1`,
              [user_id]
            );
          }
        } else if (event === "payment.failed" || event === "charge.failed") {
          const { user_id, payment_id } = req.body.data || req.body;

          if (user_id && payment_id) {
            await pool.query(
              `INSERT INTO payments (
                user_id,
                payment_id,
                status,
                provider,
                created_at
              )
              VALUES ($1, $2, 'failed', $3, NOW())`,
              [user_id, payment_id, provider]
            );
          }
        }

        await logWebhook(provider, event, req.body, "processed");
      });

      return res.json({
        success: true,
        message: "Webhook received",
      });
    } catch (err) {
      console.error("Payment webhook error:", err.message);
      await logWebhook("payment", "error", req.body, "error");
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/webhooks/email - Email service callbacks
   */
  router.post("/email", async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many requests",
      });
    }

    try {
      const provider = req.headers["x-webhook-provider"] || req.headers["x-mailgun-sid"] || "sendgrid";
      const event = req.body.event || req.body["event-data"]?.event || "email";

      // Idempotency check
      const idempotencyKey = req.body.id || req.body["event-data"]?.id;
      if (idempotencyKey) {
        const isDuplicate = await checkIdempotency(`email:${idempotencyKey}`);
        if (isDuplicate) {
          return res.json({
            success: true,
            message: "Already processed",
          });
        }
      }

      // Process async
      processAsync(async () => {
        if (event === "delivered") {
          const { email, user_id } = req.body;
          if (email) {
            await pool.query(
              `UPDATE users
               SET email_delivered = TRUE, last_email_at = NOW()
               WHERE email = $1`,
              [email]
            );
          }
        } else if (event === "bounced" || event === "bounce") {
          const { email, user_id } = req.body;
          if (email) {
            await pool.query(
              `UPDATE users
               SET email_bounced = TRUE, email_delivered = FALSE
               WHERE email = $1`,
              [email]
            );
          }
        } else if (event === "opened") {
          const { email, user_id } = req.body;
          if (email) {
            await pool.query(
              `INSERT INTO email_opens (user_id, email, created_at)
               SELECT id, $1, NOW() FROM users WHERE email = $1
               ON CONFLICT DO NOTHING`,
              [email]
            );
          }
        } else if (event === "clicked") {
          const { email, url } = req.body;
          if (email && url) {
            await pool.query(
              `INSERT INTO email_clicks (user_id, email, url, created_at)
               SELECT id, $1, $2, NOW() FROM users WHERE email = $1
               ON CONFLICT DO NOTHING`,
              [email, url]
            );
          }
        }

        await logWebhook(provider, event, req.body, "processed");
      });

      return res.json({
        success: true,
        message: "Webhook received",
      });
    } catch (err) {
      console.error("Email webhook error:", err.message);
      await logWebhook("email", "error", req.body, "error");
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/webhooks/push - Push notification callbacks
   */
  router.post("/push", async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many requests",
      });
    }

    try {
      const provider = req.headers["x-webhook-provider"] || "firebase";
      const event = req.body.event || "notification";

      // Idempotency check
      const idempotencyKey = req.body.message_id || req.body.id;
      if (idempotencyKey) {
        const isDuplicate = await checkIdempotency(`push:${idempotencyKey}`);
        if (isDuplicate) {
          return res.json({
            success: true,
            message: "Already processed",
          });
        }
      }

      // Process async
      processAsync(async () => {
        if (event === "delivered") {
          const { user_id, notification_id } = req.body;
          if (notification_id) {
            await pool.query(
              `UPDATE notifications
               SET delivered = TRUE, delivered_at = NOW()
               WHERE id = $1`,
              [notification_id]
            );
          }
        } else if (event === "opened") {
          const { user_id, notification_id } = req.body;
          if (notification_id) {
            await pool.query(
              `UPDATE notifications
               SET opened = TRUE, opened_at = NOW()
               WHERE id = $1`,
              [notification_id]
            );
          }
        }

        await logWebhook(provider, event, req.body, "processed");
      });

      return res.json({
        success: true,
        message: "Webhook received",
      });
    } catch (err) {
      console.error("Push webhook error:", err.message);
      await logWebhook("push", "error", req.body, "error");
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/webhooks/video - Video processing callbacks
   */
  router.post("/video", async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many requests",
      });
    }

    try {
      const provider = req.headers["x-webhook-provider"] || "mux";
      const event = req.body.type || req.body.event || "video";

      // Idempotency check
      const idempotencyKey = req.body.data?.id || req.body.id;
      if (idempotencyKey) {
        const isDuplicate = await checkIdempotency(`video:${idempotencyKey}`);
        if (isDuplicate) {
          return res.json({
            success: true,
            message: "Already processed",
          });
        }
      }

      // Process async
      processAsync(async () => {
        if (event === "video.asset.ready" || event === "ready") {
          const { asset_id, playback_id, status } = req.body.data || req.body;
          if (asset_id && status === "ready") {
            await pool.query(
              `UPDATE posts
               SET
                 video_status = 'ready',
                 video_playback_id = $1,
                 video_ready_at = NOW()
               WHERE video_asset_id = $2`,
              [playback_id, asset_id]
            );
          }
        } else if (event === "video.asset.errored" || event === "error") {
          const { asset_id, error } = req.body.data || req.body;
          if (asset_id) {
            await pool.query(
              `UPDATE posts
               SET
                 video_status = 'error',
                 video_error = $1
               WHERE video_asset_id = $2`,
              [error?.message || "Unknown error", asset_id]
            );
          }
        }

        await logWebhook(provider, event, req.body, "processed");
      });

      return res.json({
        success: true,
        message: "Webhook received",
      });
    } catch (err) {
      console.error("Video webhook error:", err.message);
      await logWebhook("video", "error", req.body, "error");
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/webhooks/social - Social media integration callbacks
   */
  router.post("/social", async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many requests",
      });
    }

    try {
      const provider = req.headers["x-webhook-provider"] || "instagram";
      const event = req.body.object || req.body.event || "social";

      // Idempotency check
      const idempotencyKey = req.body.entry?.[0]?.time || req.body.id;
      if (idempotencyKey) {
        const isDuplicate = await checkIdempotency(`social:${idempotencyKey}`);
        if (isDuplicate) {
          return res.json({
            success: true,
            message: "Already processed",
          });
        }
      }

      // Process async
      processAsync(async () => {
        // Handle Instagram, Twitter, YouTube callbacks here
        if (provider === "instagram" && event === "instagram") {
          const entries = req.body.entry || [];
          for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
              if (change.field === "media") {
                // New media posted
                await logWebhook(provider, "media_posted", change.value, "processed");
              }
            }
          }
        }

        await logWebhook(provider, event, req.body, "processed");
      });

      return res.json({
        success: true,
        message: "Webhook received",
      });
    } catch (err) {
      console.error("Social webhook error:", err.message);
      await logWebhook("social", "error", req.body, "error");
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/webhooks/analytics - Analytics service callbacks
   */
  router.post("/analytics", async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limit check
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: "Too many requests",
      });
    }

    try {
      const provider = req.headers["x-webhook-provider"] || "mixpanel";
      const event = req.body.event || "analytics";

      // Idempotency check
      const idempotencyKey = req.body.event_id || req.body.id;
      if (idempotencyKey) {
        const isDuplicate = await checkIdempotency(`analytics:${idempotencyKey}`);
        if (isDuplicate) {
          return res.json({
            success: true,
            message: "Already processed",
          });
        }
      }

      // Process async
      processAsync(async () => {
        // Store analytics events
        await pool.query(
          `INSERT INTO analytics_events (
            provider,
            event_type,
            payload,
            created_at
          )
          VALUES ($1, $2, $3, NOW())`,
          [provider, event, JSON.stringify(req.body)]
        );

        await logWebhook(provider, event, req.body, "processed");
      });

      return res.json({
        success: true,
        message: "Webhook received",
      });
    } catch (err) {
      console.error("Analytics webhook error:", err.message);
      await logWebhook("analytics", "error", req.body, "error");
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};