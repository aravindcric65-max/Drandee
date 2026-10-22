const express = require("express");
const authMiddleware = require("../middleware/auth");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_SUBSCRIPTION_REQUESTS_PER_MINUTE: 10,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_SUBSCRIPTION_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  // Plan definitions
  const PLANS = {
    free: {
      id: "free",
      name: "Free",
      price: 0,
      currency: "INR",
      features: [
        "Unlimited posts",
        "Full feed access",
        "Follow/unlimited",
        "Basic analytics",
        "Comments & respects",
        "Share & save",
      ],
      limits: {
        maxPostsPerDay: null, // unlimited
        maxVideoDuration: 300, // 5 min
        maxFileSize: 100, // 100 MB
      },
    },
    pro: {
      id: "pro",
      name: "Pro",
      price: 99,
      currency: "INR",
      features: [
        "All Free features",
        "Advanced analytics",
        "Monetization tools",
        "Brand deals access",
        "Custom badges",
        "Priority support",
        "Higher upload limits",
      ],
      limits: {
        maxPostsPerDay: null,
        maxVideoDuration: 1800, // 30 min
        maxFileSize: 500, // 500 MB
      },
    },
    enterprise: {
      id: "enterprise",
      name: "Enterprise",
      price: 499,
      currency: "INR",
      features: [
        "All Pro features",
        "Team management",
        "API access",
        "Dedicated support",
        "Custom branding",
        "White-label options",
        "Advanced monetization",
      ],
      limits: {
        maxPostsPerDay: null,
        maxVideoDuration: 7200, // 2 hours
        maxFileSize: 2000, // 2 GB
      },
    },
  };

  const formatSubscription = (row) => ({
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    trialEndsAt: row.trial_ends_at,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    createdAt: row.created_at,
  });

  /*
   * GET /api/subscription/plans - Get available plans
   */
  router.get("/plans", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      return res.json({
        success: true,
        plans: Object.values(PLANS),
      });
    } catch (err) {
      console.error("Get plans error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/subscription/status - Check subscription status
   */
  router.get("/status", authMiddleware, async (req, res) => {
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
          user_id,
          plan,
          status,
          start_date,
          end_date,
          trial_ends_at,
          cancel_at_period_end,
          created_at
         FROM subscriptions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      const subscription = result.rows[0];

      if (!subscription) {
        // No subscription = Free plan
        return res.json({
          success: true,
          subscription: {
            plan: "free",
            status: "active",
            features: PLANS.free.features,
            limits: PLANS.free.limits,
          },
        });
      }

      const plan = PLANS[subscription.plan] || PLANS.free;
      const isTrial = subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date();

      return res.json({
        success: true,
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
          features: plan.features,
          limits: plan.limits,
          startDate: subscription.start_date,
          endDate: subscription.end_date,
          trialEndsAt: subscription.trial_ends_at,
          isTrial,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
    } catch (err) {
      console.error("Get subscription status error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/subscription/subscribe - Start subscription (with 1st month FREE trial)
   */
  router.post("/subscribe", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { plan } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!plan || !PLANS[plan]) {
        return res.status(400).json({
          success: false,
          error: "Invalid plan",
        });
      }

      if (plan === "free") {
        return res.json({
          success: true,
          message: "You're already on the Free plan",
          plan: PLANS.free,
        });
      }

      await client.query("BEGIN");

      // Check existing subscription
      const existing = await client.query(
        `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      const trialEndsAt = new Date();
      trialEndsAt.setMonth(trialEndsAt.getMonth() + 1); // 1st month FREE

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      let result;

      if (existing.rows.length > 0) {
        // Update existing subscription
        result = await client.query(
          `UPDATE subscriptions
           SET
             plan = $1,
             status = 'active',
             end_date = $2,
             trial_ends_at = $3,
             updated_at = NOW()
           WHERE user_id = $4
           RETURNING *`,
          [plan, endDate, trialEndsAt, userId]
        );
      } else {
        // Create new subscription
        result = await client.query(
          `INSERT INTO subscriptions (
            user_id,
            plan,
            status,
            start_date,
            end_date,
            trial_ends_at,
            created_at
          )
          VALUES ($1, $2, 'active', NOW(), $3, $4, NOW())
          RETURNING *`,
          [userId, plan, endDate, trialEndsAt]
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        subscription: {
          plan,
          status: "active",
          features: PLANS[plan].features,
          limits: PLANS[plan].limits,
          startDate: result.rows[0].start_date,
          endDate: result.rows[0].end_date,
          trialEndsAt: result.rows[0].trial_ends_at,
          message: "1st month FREE! After that, you'll be charged ₹" + PLANS[plan].price + "/month",
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Subscribe rollback error:", rollbackError.message);
      }
      console.error("Subscribe error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/subscription/cancel - Cancel subscription
   */
  router.post("/cancel", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE subscriptions
         SET
           cancel_at_period_end = TRUE,
           updated_at = NOW()
         WHERE user_id = $1 AND status = 'active'
         RETURNING *`,
        [userId]
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          message: "You're on the Free plan. No subscription to cancel.",
        });
      }

      return res.json({
        success: true,
        message: "Subscription cancelled. You'll have access until the end of the billing period.",
        subscription: {
          plan: result.rows[0].plan,
          cancelAtPeriodEnd: true,
          endDate: result.rows[0].end_date,
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Cancel rollback error:", rollbackError.message);
      }
      console.error("Cancel subscription error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/subscription/upgrade - Upgrade to higher plan
   */
  router.post("/upgrade", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { plan } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!plan || !PLANS[plan]) {
        return res.status(400).json({
          success: false,
          error: "Invalid plan",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE subscriptions
         SET
           plan = $1,
           updated_at = NOW()
         WHERE user_id = $2 AND status = 'active'
         RETURNING *`,
        [plan, userId]
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No active subscription found",
        });
      }

      return res.json({
        success: true,
        message: "Upgraded to " + PLANS[plan].name + " plan!",
        subscription: {
          plan,
          features: PLANS[plan].features,
          limits: PLANS[plan].limits,
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Upgrade rollback error:", rollbackError.message);
      }
      console.error("Upgrade error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/subscription/downgrade - Downgrade to lower plan
   */
  router.post("/downgrade", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { plan } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!plan || !PLANS[plan]) {
        return res.status(400).json({
          success: false,
          error: "Invalid plan",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE subscriptions
         SET
           plan = $1,
           cancel_at_period_end = FALSE,
           updated_at = NOW()
         WHERE user_id = $2 AND status = 'active'
         RETURNING *`,
        [plan, userId]
      );

      await client.query("COMMIT");

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No active subscription found",
        });
      }

      return res.json({
        success: true,
        message: "Downgraded to " + PLANS[plan].name + " plan!",
        subscription: {
          plan,
          features: PLANS[plan].features,
          limits: PLANS[plan].limits,
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Downgrade rollback error:", rollbackError.message);
      }
      console.error("Downgrade error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/subscription/billing - Billing history
   */
  router.get("/billing", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);

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
          user_id,
          amount,
          currency,
          status,
          plan,
          created_at
         FROM payments
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return res.json({
        success: true,
        billing: result.rows.map((row) => ({
          id: row.id,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          plan: row.plan,
          createdAt: row.created_at,
        })),
        pagination: {
          limit,
          count: result.rows.length,
        },
      });
    } catch (err) {
      console.error("Get billing error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/subscription/refund - Request refund
   */
  router.post("/refund", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { paymentId, reason } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!paymentId || !reason) {
        return res.status(400).json({
          success: false,
          error: "paymentId and reason required",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO refund_requests (
          user_id,
          payment_id,
          reason,
          status,
          created_at
        )
        VALUES ($1, $2, $3, 'pending', NOW())
        RETURNING *`,
        [userId, paymentId, reason]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        refundRequest: {
          id: result.rows[0].id,
          paymentId: result.rows[0].payment_id,
          reason: result.rows[0].reason,
          status: result.rows[0].status,
          createdAt: result.rows[0].created_at,
        },
        message: "Refund request submitted. We'll review it within 3-5 business days.",
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Refund rollback error:", rollbackError.message);
      }
      console.error("Request refund error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  return router;
};