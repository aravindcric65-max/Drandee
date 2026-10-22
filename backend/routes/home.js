const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { 
  rankForYou, 
  rankFollowing, 
  rankLocal, 
  applyDiversityEngine 
} = require('../utils/rankingEngine');
const { loadUserSafetyLists, filterCandidates, getSafetyWhereClause } = require('../utils/safetyFilter');

// ═════════════════════════════════════════════════════════
// DEBUG HELPER: Feed Stage Diagnostics (Development Only)
// ═════════════════════════════════════════════════════════
const debugFeedStage = (stage, rows) => {
  if (process.env.NODE_ENV !== "development") return;
  const list = Array.isArray(rows) ? rows : [];
  console.info("[feed-debug]", {
    stage,
    count: list.length,
    samplePostIds: list.slice(0, 5).map((post) => post?.id).filter((id) => id !== null && id !== undefined),
    contentTypes: [...new Set(list.slice(0, 20).map((post) => post?.content_type || post?.type).filter(Boolean))],
  });
};

// GET /api/home/feed
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const { mode = 'for_you', cursor, limit = 20 } = req.query;
    const userId = req.auth.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }
    
    // 1. Fetch user context for personalization
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    
    if (process.env.NODE_ENV === "development") {
      console.info("[feed-debug] auth-context", { userId, hasUser: !!user });
    }
    
    let userInterests = { interests: [], session_interests: [] };
    try {
      const interestsRes = await pool.query('SELECT * FROM user_interests WHERE user_id = $1', [userId]);
      userInterests = interestsRes.rows[0] || { interests: [], session_interests: [] };
    } catch (_) {
      // user_interests table may not exist yet — use defaults
    }
    
    const followsRes = await pool.query('SELECT following_id FROM follows WHERE follower_id = $1', [userId]);
    const followsSet = new Set(followsRes.rows.map(r => r.following_id));
    
    const userContext = { user, interests: userInterests, followsSet };
    const userSafetyData = await loadUserSafetyLists(pool, userId);
    
    if (process.env.NODE_ENV === "development") {
      console.info("[feed-debug] safety-lists", {
        blockedCount: userSafetyData.blocked?.length || 0,
        mutedCount: userSafetyData.muted?.length || 0,
        hiddenCount: userSafetyData.hidden?.length || 0
      });
    }
    
    // 2. Fetch candidate posts
    // For simplicity, we fetch recent 100 eligible posts and rank them in JS
    // In production this would use more advanced SQL filtering for candidates
    let candidateQuery = `
      SELECT 
        p.*,
        u.username AS creator_username,
        u.name AS creator_display_name,
        u.profile_pic AS creator_avatar,
        u.identity_level AS creator_identity_level,
        EXISTS (
          SELECT 1 FROM respects r
          WHERE r.post_id = p.id AND r.user_id = $1
        ) AS has_respected,
        EXISTS (
          SELECT 1 FROM saved_posts sp
          WHERE sp.post_id = p.id AND sp.user_id = $1
        ) AS has_saved
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
        ${getSafetyWhereClause()}
    `;
    
    if (mode === 'following') {
      candidateQuery += ` AND p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1) AND p.user_id != $1`;
    } else if (mode === 'local') {
      // Match creators from same city/state, excluding own posts
      candidateQuery += ` AND u.city = (SELECT city FROM users WHERE id = $1)
        AND u.state = (SELECT state FROM users WHERE id = $1) 
        AND p.user_id != $1`;
    }
    
    candidateQuery += ` ORDER BY p.created_at DESC LIMIT 100`;
    
    let candidateValues = [userId]; // userId is $1 for safety filter
    
    const candidatesResult = await pool.query(candidateQuery, candidateValues);
    debugFeedStage("1-sql-candidates", candidatesResult.rows);
    
    let candidateRows = filterCandidates(candidatesResult.rows, userSafetyData);
    debugFeedStage("2-filter-candidates", candidateRows);
    
    // 3. Rank candidates
    let rankedPosts = [];
    if (mode === 'following') {
      rankedPosts = candidateRows.map(post => rankFollowing(post, userContext));
    } else if (mode === 'local') {
      rankedPosts = candidateRows.map(post => rankLocal(post, userContext));
    } else {
      rankedPosts = candidateRows.map(post => rankForYou(post, userContext));
    }
    debugFeedStage("3-ranking", rankedPosts);
    
    // 4. Apply Diversity and Rhythm Engine
    const finalFeed = applyDiversityEngine(rankedPosts, parseInt(limit));
    debugFeedStage("4-diversity", finalFeed);
    
    const { formatPost } = require('../models/postModel');
    const candidateById = new Map(candidateRows.map(r => [r.id, r]));
    const formattedPosts = finalFeed.map(rankedPost => {
      const original = candidateById.get(rankedPost.id);
      return formatPost(original ? { ...original, ...rankedPost } : rankedPost);
    });
    debugFeedStage("5-formatting", formattedPosts);
    
    const nextCursor = formattedPosts.length > 0 
      ? formattedPosts[formattedPosts.length - 1].id 
      : null;
    
    if (process.env.NODE_ENV === "development") {
      console.info("[feed-debug] 6-response", { finalCount: formattedPosts.length, hasMore: formattedPosts.length === parseInt(limit) });
    }
    
    res.json({
      success: true,
      data: {
        items: formattedPosts,
        nextCursor,
        hasMore: formattedPosts.length === parseInt(limit),
        mode
      }
    });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
});

// GET /api/home/trending
router.get('/trending', authMiddleware, async (req, res) => {
  try {
    const { scope = 'global' } = req.query;
    // Stub for Local Trending module
    res.json({ success: true, data: { items: [], scope } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/home/recommended-creators
router.get('/recommended-creators', authMiddleware, async (req, res) => {
  try {
    const { scope = 'global' } = req.query;
    // Stub for Recommended Creators module
    res.json({ success: true, data: { items: [], scope } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/home/continue-watching
router.get('/continue-watching', authMiddleware, async (req, res) => {
  try {
    // Stub for Continue Watching module
    res.json({ success: true, data: { items: [] } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/home/impression
router.post('/impression', authMiddleware, async (req, res) => {
  try {
    const { postId, action, dwellTime } = req.body;
    const userId = req.auth.userId;

    if (!postId) {
      return res.status(400).json({ success: false, error: 'postId required' });
    }

    // Use ON CONFLICT DO NOTHING to deduplicate same user+post+action within a session.
    // feed_impressions may not have a unique index; if not, this silently falls back to
    // a plain INSERT. Either way we never fail the feed loop.
    await pool.query(
    `INSERT INTO feed_impressions (user_id, post_id, action, dwell_time)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, post_id, action)
    DO UPDATE SET dwell_time = GREATEST(COALESCE(feed_impressions.dwell_time, 0), EXCLUDED.dwell_time)`,
    [userId, postId, action || 'view', dwellTime || 0]
);
    
    res.json({ success: true });
  } catch (error) {
    // Return 200 even on error to not break the frontend feed loop
    res.json({ success: false, error: 'Server error' });
  }
});

// POST /api/home/watch-event
router.post('/watch-event', authMiddleware, async (req, res) => {
  try {
    const { postId, eventType, duration, completion } = req.body;
    // Event types: video_start, video_25, video_50, video_75, video_complete, video_rewatch, video_skip
    
    // Stub: Logic to calculate "Watch Quality" and update watch_history
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;