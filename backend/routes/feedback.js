const express = require("express");
const authMiddleware = require("../middleware/auth");

module.exports = (pool) => {
  const router = express.Router();

  // Rate limiting - NEW!
  const rateLimits = {
    MAX_FEEDBACK_REQUESTS_PER_MINUTE: 10,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const userReqs = rateLimits.userRequests.get(userId) || [];
    const recentReqs = userReqs.filter(t => now - t < 60000);
    
    if (recentReqs.length >= rateLimits.MAX_FEEDBACK_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    recentReqs.push(now);
    rateLimits.userRequests.set(userId, recentReqs);
    return true;
  };

  const isAdmin = (req) => {
    return req.auth.role === "admin" || req.user?.is_admin === true;
  };

  const formatFeedback = (row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    category: row.category,
    type: row.type,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    votes: row.votes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    adminResponse: row.admin_response,
  });

  const formatTicket = (row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  });

  const formatReview = (row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    createdAt: row.created_at,
  });

  /*
   * POST /api/feedback - Submit new feedback
   */
  router.post("/", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { category, type, subject, description, priority } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!category || !subject || !description) {
        return res.status(400).json({
          success: false,
          error: "category, subject, and description required",
        });
      }

      const validCategories = ["bug", "feature", "complaint", "suggestion", "other"];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO feedback (
          user_id,
          category,
          type,
          subject,
          description,
          priority,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
        RETURNING id, user_id, category, type, subject, description, priority, status, votes, created_at`,
        [userId, category, type || null, subject, description, priority || "medium"]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        feedback: {
          id: result.rows[0].id,
          userId: result.rows[0].user_id,
          category: result.rows[0].category,
          type: result.rows[0].type,
          subject: result.rows[0].subject,
          description: result.rows[0].description,
          priority: result.rows[0].priority,
          status: result.rows[0].status,
          votes: result.rows[0].votes,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Feedback rollback error:", rollbackError.message);
      }
      console.error("Submit feedback error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/feedback/my-feedback - Get user's feedback history
   */
  router.get("/my-feedback", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      const result = await pool.query(
        `SELECT
          id,
          user_id,
          category,
          type,
          subject,
          description,
          priority,
          status,
          votes,
          admin_response,
          created_at,
          updated_at
         FROM feedback
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return res.json({
        success: true,
        feedback: result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          category: row.category,
          type: row.type,
          subject: row.subject,
          description: row.description,
          priority: row.priority,
          status: row.status,
          votes: row.votes,
          adminResponse: row.admin_response,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get user feedback error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * GET /api/feedback - Get all feedback (admin)
   */
  router.get("/", authMiddleware, async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = parseInt(req.query.offset) || 0;
      const category = req.query.category || null;
      const status = req.query.status || null;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      let query = `
        SELECT
          f.id,
          f.user_id,
          u.name AS user_name,
          f.category,
          f.type,
          f.subject,
          f.description,
          f.priority,
          f.status,
          f.votes,
          f.admin_response,
          f.created_at,
          f.updated_at
        FROM feedback f
        INNER JOIN users u ON u.id = f.user_id
        WHERE 1=1
      `;

      const params = [];

      if (category) {
        query += ` AND f.category = $${params.length + 1}`;
        params.push(category);
      }

      if (status) {
        query += ` AND f.status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY f.votes DESC, f.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        feedback: result.rows.map(formatFeedback),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get all feedback error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/feedback/:id - Update feedback status (admin)
   */
  router.put("/:id", authMiddleware, async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    try {
      const adminId = req.auth.userId;
      const feedbackId = parseInt(req.params.id, 10);
      const { status, priority, adminResponse } = req.body;

      if (!Number.isInteger(feedbackId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid feedback ID",
        });
      }

      const result = await pool.query(
        `UPDATE feedback
         SET
           status = COALESCE($1, status),
           priority = COALESCE($2, priority),
           admin_response = COALESCE($3, admin_response),
           updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, priority, adminResponse, feedbackId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Feedback not found",
        });
      }

      return res.json({
        success: true,
        feedback: formatFeedback(result.rows[0]),
      });
    } catch (err) {
      console.error("Update feedback error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/feedback/:id/vote - Upvote feature request
   */
  router.post("/:id/vote", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const feedbackId = parseInt(req.params.id, 10);

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!Number.isInteger(feedbackId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid feedback ID",
        });
      }

      await client.query("BEGIN");

      // Check if already voted
      const existing = await client.query(
        `SELECT id FROM feedback_votes WHERE user_id = $1 AND feedback_id = $2`,
        [userId, feedbackId]
      );

      let voted;
      let voteCount;

      if (existing.rows.length > 0) {
        // Remove vote
        await client.query(
          `DELETE FROM feedback_votes WHERE user_id = $1 AND feedback_id = $2`,
          [userId, feedbackId]
        );

        const result = await client.query(
          `UPDATE feedback
           SET votes = GREATEST(COALESCE(votes, 0) - 1, 0)
           WHERE id = $3
           RETURNING votes`,
          [userId, feedbackId, feedbackId]
        );

        voted = false;
        voteCount = result.rows[0].votes;
      } else {
        // Add vote
        await client.query(
          `INSERT INTO feedback_votes (user_id, feedback_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, feedback_id) DO NOTHING`,
          [userId, feedbackId]
        );

        const result = await client.query(
          `UPDATE feedback
           SET votes = COALESCE(votes, 0) + 1
           WHERE id = $3
           RETURNING votes`,
          [userId, feedbackId, feedbackId]
        );

        voted = true;
        voteCount = result.rows[0].votes;
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        voted,
        votes: voteCount,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Vote rollback error:", rollbackError.message);
      }
      console.error("Vote feedback error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * POST /api/feedback/ticket - Create support ticket
   */
  router.post("/ticket", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { subject, description, priority } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!subject || !description) {
        return res.status(400).json({
          success: false,
          error: "subject and description required",
        });
      }

      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO support_tickets (
          user_id,
          subject,
          description,
          priority,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, 'open', NOW())
        RETURNING id, user_id, subject, description, priority, status, created_at`,
        [userId, subject, description, priority || "medium"]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        ticket: {
          id: result.rows[0].id,
          userId: result.rows[0].user_id,
          subject: result.rows[0].subject,
          description: result.rows[0].description,
          priority: result.rows[0].priority,
          status: result.rows[0].status,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Ticket rollback error:", rollbackError.message);
      }
      console.error("Create ticket error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/feedback/tickets - Get support tickets
   */
  router.get("/tickets", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status || null;

      let query = `
        SELECT
          id,
          user_id,
          subject,
          description,
          priority,
          status,
          assigned_to,
          created_at,
          updated_at,
          resolved_at
        FROM support_tickets
        WHERE user_id = $1
      `;

      const params = [userId];

      if (status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return res.json({
        success: true,
        tickets: result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          subject: row.subject,
          description: row.description,
          priority: row.priority,
          status: row.status,
          assignedTo: row.assigned_to,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          resolvedAt: row.resolved_at,
        })),
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get tickets error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * PUT /api/feedback/ticket/:id - Update ticket (admin)
   */
  router.put("/ticket/:id", authMiddleware, async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    try {
      const adminId = req.auth.userId;
      const ticketId = parseInt(req.params.id, 10);
      const { status, priority, assignedTo, response } = req.body;

      if (!Number.isInteger(ticketId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid ticket ID",
        });
      }

      const result = await pool.query(
        `UPDATE support_tickets
         SET
           status = COALESCE($1, status),
           priority = COALESCE($2, priority),
           assigned_to = COALESCE($3, assigned_to),
           admin_response = COALESCE($4, admin_response),
           resolved_at = CASE WHEN COALESCE($1, status) = 'resolved' THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [status, priority, assignedTo, response, ticketId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Ticket not found",
        });
      }

      return res.json({
        success: true,
        ticket: formatTicket(result.rows[0]),
      });
    } catch (err) {
      console.error("Update ticket error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  /*
   * POST /api/feedback/review - Submit app review
   */
  router.post("/review", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = req.auth.userId;
      const { rating, title, comment } = req.body;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return res.status(429).json({
          success: false,
          error: "Too many requests. Please slow down.",
        });
      }

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: "rating must be 1-5",
        });
      }

      await client.query("BEGIN");

      // Check if already reviewed
      const existing = await client.query(
        `SELECT id FROM app_reviews WHERE user_id = $1`,
        [userId]
      );

      if (existing.rows.length > 0) {
        // Update existing review
        const result = await client.query(
          `UPDATE app_reviews
           SET
             rating = $1,
             title = COALESCE($2, title),
             comment = COALESCE($3, comment),
             updated_at = NOW()
           WHERE user_id = $4
           RETURNING *`,
          [rating, title, comment, userId]
        );

        await client.query("COMMIT");

        return res.json({
          success: true,
          review: formatReview(result.rows[0]),
          updated: true,
        });
      } else {
        // Create new review
        const result = await client.query(
          `INSERT INTO app_reviews (
            user_id,
            rating,
            title,
            comment,
            created_at
          )
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING *`,
          [userId, rating, title || null, comment || null]
        );

        await client.query("COMMIT");

        return res.status(201).json({
          success: true,
          review: formatReview(result.rows[0]),
          updated: false,
        });
      }
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Review rollback error:", rollbackError.message);
      }
      console.error("Submit review error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    } finally {
      client.release();
    }
  });

  /*
   * GET /api/feedback/reviews - Get app reviews
   */
  router.get("/reviews", authMiddleware, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const rating = parseInt(req.query.rating) || null;

      let query = `
        SELECT
          id,
          user_id,
          rating,
          title,
          comment,
          created_at
        FROM app_reviews
        WHERE 1=1
      `;

      const params = [];

      if (rating) {
        query += ` AND rating = $${params.length + 1}`;
        params.push(rating);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Calculate average rating
      const avgResult = await pool.query(
        `SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM app_reviews`
      );

      return res.json({
        success: true,
        reviews: result.rows.map(formatReview),
        stats: {
          averageRating: parseFloat(avgResult.rows[0].avg_rating) || 0,
          totalReviews: parseInt(avgResult.rows[0].count, 10),
        },
        pagination: {
          limit,
          offset,
          count: result.rows.length,
          hasMore: result.rows.length === limit,
        },
      });
    } catch (err) {
      console.error("Get reviews error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Server error",
      });
    }
  });

  return router;
};