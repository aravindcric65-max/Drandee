/**
 * routes/hashtags.js
 * Hashtag summary and posts endpoints.
 *
 * GET /api/hashtags/:tag/summary  — stats, related tags, top creators, top audio
 * GET /api/hashtags/:tag/posts    — paginated posts matching a tag
 */

const express = require("express");
const authMiddleware = require("../middleware/auth");
const { normalizeMediaUrl } = require("../utils/mediaUrl");
const { formatPost } = require("../models/postModel");

module.exports = (pool) => {
  const router = express.Router();

  // ── Rate limiter: 100 req/min per userId ──────────────────────────────────
  const _rateLimits = {
    MAX_PER_MINUTE: 100,
    userRequests: new Map(),
  };

  const checkRateLimit = (userId) => {
    const now = Date.now();
    const prev = _rateLimits.userRequests.get(userId) || [];
    const recent = prev.filter((t) => now - t < 60000);
    if (recent.length >= _rateLimits.MAX_PER_MINUTE) return false;
    recent.push(now);
    _rateLimits.userRequests.set(userId, recent);
    return true;
  };

  // ── Tag validation & normalisation ───────────────────────────────────────
  /**
   * Returns the normalised tag string (no #, lowercase) or null if invalid.
   * Accepts Unicode letters/numbers/underscore, max 50 chars.
   */
  const normaliseTag = (raw) => {
    const stripped = String(raw || "").replace(/^#+/, "").trim().toLowerCase();
    if (!stripped) return null;
    if (stripped.length > 50) return null;
    // Unicode-aware: letters, numbers, underscore only
    if (!/^[\p{L}\p{N}_]{1,50}$/u.test(stripped)) return null;
    return stripped;
  };

  /** Escape ILIKE wildcard metacharacters in the tag string. */
  const escapeLike = (s) => s.replace(/%/g, "\\%").replace(/_/g, "\\_");

  // ── Inline safety conditions (using $1=userId, $2=tag, $3=likePattern) ───
  // We inline rather than use getSafetyWhereClause to avoid $1 parameter shift.
  const SAFETY_WHERE = `
    AND p.is_deleted IS NOT TRUE
    AND (p.moderation_status IS NULL OR p.moderation_status = 'approved')
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE ub.blocker_id = $1 AND ub.blocked_id = p.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub2
      WHERE ub2.blocker_id = p.user_id AND ub2.blocked_id = $1
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_mutes um
      WHERE um.user_id = $1 AND um.muted_id = p.user_id
    )
    AND (
      p.is_private IS NOT TRUE
      OR EXISTS (
        SELECT 1 FROM follows f_priv
        WHERE f_priv.follower_id = $1 AND f_priv.following_id = p.user_id
      )
    )
  `;

  /** The core tag-match condition (uses $2 and $3). */
  const TAG_MATCH = `(
    p.tags @> ARRAY[$2]::text[]
    OR p.caption ILIKE $3
    OR p.overlay_text ILIKE $3
  )`;

  // ============================================================
  // GET /api/hashtags/:tag/summary
  // ============================================================
  const getTagSummary = async (req, res) => {
    try {
      const userId = req.auth.userId;

      if (!checkRateLimit(userId)) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
      }

      const tag = normaliseTag(req.params.tag);
      if (!tag) {
        return res.status(400).json({ success: false, error: "Invalid tag name." });
      }

      const likePattern = `%#${escapeLike(tag)}%`;
      const params = [userId, tag, likePattern];

      // ── 1. Aggregate stats ────────────────────────────────────────────────
      const statsResult = await pool.query(
        `SELECT
           COUNT(DISTINCT p.id)::int                      AS post_count,
           COALESCE(SUM(p.watch_count), 0)::bigint        AS total_views,
           COALESCE(SUM(p.total_respects), 0)::bigint     AS total_respects
         FROM posts p
         WHERE TRUE
           ${SAFETY_WHERE}
           AND ${TAG_MATCH}`,
        params
      );

      const stats = statsResult.rows[0] || { post_count: 0, total_views: 0, total_respects: 0 };

      // ── 2. Related tags ───────────────────────────────────────────────────
      const relatedResult = await pool.query(
        `SELECT t, COUNT(*)::int AS cnt
         FROM posts p, unnest(p.tags) AS t
         WHERE p.is_deleted IS NOT TRUE
           AND (p.moderation_status IS NULL OR p.moderation_status = 'approved')
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE ub.blocker_id = $1 AND ub.blocked_id = p.user_id
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub2
             WHERE ub2.blocker_id = p.user_id AND ub2.blocked_id = $1
           )
           AND NOT EXISTS (
             SELECT 1 FROM user_mutes um
             WHERE um.user_id = $1 AND um.muted_id = p.user_id
           )
           AND (
             p.is_private IS NOT TRUE
             OR EXISTS (
               SELECT 1 FROM follows f_priv
               WHERE f_priv.follower_id = $1 AND f_priv.following_id = p.user_id
             )
           )
           AND t <> $2
           AND ${TAG_MATCH}
         GROUP BY t
         ORDER BY cnt DESC
         LIMIT 10`,
        params
      );

      const relatedTags = relatedResult.rows.map((r) => ({ tag: r.t, count: r.cnt }));

      // ── 3. Top creators ───────────────────────────────────────────────────
      const creatorsResult = await pool.query(
        `SELECT
           u.id,
           u.username,
           u.name              AS display_name,
           u.profile_pic       AS avatar_url,
           u.identity_level,
           COUNT(p.id)::int    AS post_count,
           EXISTS (
             SELECT 1 FROM follows f
             WHERE f.follower_id = $1 AND f.following_id = u.id
           )                   AS is_following
         FROM posts p
         JOIN users u ON COALESCE(p.user_id, p.creator_id) = u.id
         WHERE p.is_deleted IS NOT TRUE
           AND (p.moderation_status IS NULL OR p.moderation_status = 'approved')
           AND ${TAG_MATCH}
         GROUP BY u.id, u.username, u.name, u.profile_pic, u.identity_level
         ORDER BY post_count DESC
         LIMIT 10`,
        params
      );

      const topCreators = creatorsResult.rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: normalizeMediaUrl(r.avatar_url),
        isVerified: r.identity_level != null && r.identity_level > 0,
        postCount: r.post_count,
        isFollowing: Boolean(r.is_following),
      }));

      // ── 4. Top audio ──────────────────────────────────────────────────────
      let topAudio = [];
      try {
        const audioResult = await pool.query(
          `SELECT DISTINCT ON (p.audio_id)
             p.audio_id,
             p.audio_name,
             a.audio_url,
             a.thumbnail_url,
             a.artist,
             COUNT(p2.id) OVER (PARTITION BY p.audio_id) AS usage_count
           FROM posts p
           LEFT JOIN audios a ON a.id = p.audio_id
           JOIN posts p2 ON p2.audio_id = p.audio_id AND p2.is_deleted IS NOT TRUE
           WHERE p.is_deleted IS NOT TRUE
             AND (p.moderation_status IS NULL OR p.moderation_status = 'approved')
             AND NOT EXISTS (
               SELECT 1 FROM user_blocks ub
               WHERE ub.blocker_id = $1 AND ub.blocked_id = p.user_id
             )
             AND NOT EXISTS (
               SELECT 1 FROM user_blocks ub2
               WHERE ub2.blocker_id = p.user_id AND ub2.blocked_id = $1
             )
             AND NOT EXISTS (
               SELECT 1 FROM user_mutes um
               WHERE um.user_id = $1 AND um.muted_id = p.user_id
             )
             AND (
               p.is_private IS NOT TRUE
               OR EXISTS (
                 SELECT 1 FROM follows f_priv
                 WHERE f_priv.follower_id = $1 AND f_priv.following_id = p.user_id
               )
             )
             AND p.audio_id IS NOT NULL
             AND ${TAG_MATCH}
           ORDER BY p.audio_id, usage_count DESC
           LIMIT 10`,
          params
        );

        topAudio = audioResult.rows.map((r) => ({
          audioId: r.audio_id,
          audioName: r.audio_name,
          audioUrl: r.audio_url,
          thumbnailUrl: r.thumbnail_url,
          artist: r.artist,
          usageCount: parseInt(r.usage_count, 10) || 0,
        }));
      } catch (audioErr) {
        // Fail gracefully — audios table columns may vary
        console.warn("[hashtags] topAudio query failed (non-fatal):", audioErr.message);
        topAudio = [];
      }

      return res.json({
        success: true,
        tag,
        postCount: parseInt(stats.post_count, 10) || 0,
        totalViews: parseInt(stats.total_views, 10) || 0,
        totalRespects: parseInt(stats.total_respects, 10) || 0,
        relatedTags,
        topCreators,
        topAudio,
      });
    } catch (err) {
      console.error("[hashtags] summary error code=%s message=%s\n%s", err.code, err.message, err.stack);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  };

  // ============================================================
  // GET /api/hashtags/:tag/posts
  // ============================================================
  const getTagPosts = async (req, res) => {
    try {
      const userId = req.auth.userId;

      if (!checkRateLimit(userId)) {
        return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
      }

      const tag = normaliseTag(req.params.tag);
      if (!tag) {
        return res.status(400).json({ success: false, error: "Invalid tag name." });
      }

      const sort   = req.query.sort === "top" ? "top" : "recent";
      const type   = ["video", "image", "text"].includes(req.query.type) ? req.query.type : "all";
      const limit  = Math.min(Math.max(parseInt(req.query.limit)  || 20, 1), 50);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);

      const likePattern = `%#${escapeLike(tag)}%`;
      const params = [userId, tag, likePattern];

      // ── Type filter ───────────────────────────────────────────────────────
      const typeClause =
        type === "video" ? "AND p.content_type = 'video'"
        : type === "image" ? "AND p.content_type IN ('image','carousel')"
        : type === "text"  ? "AND p.content_type = 'text'"
        : "";

      // ── Sort clause ───────────────────────────────────────────────────────
      const orderClause =
        sort === "top"
          ? "ORDER BY (p.total_respects * 3 + p.comment_count * 2 + p.watch_count) DESC, p.created_at DESC"
          : "ORDER BY p.created_at DESC";

      // ── Dynamic param indices for limit/offset ────────────────────────────
      const limitIdx  = params.length + 1;  // $4
      const offsetIdx = params.length + 2;  // $5
      params.push(limit, offset);

      const result = await pool.query(
        `SELECT
           p.*,
           u.username         AS creator_username,
           u.name             AS creator_display_name,
           u.profile_pic      AS creator_avatar,
           u.identity_level   AS creator_identity_level,
           EXISTS (
             SELECT 1 FROM respects r
             WHERE r.post_id = p.id AND r.user_id = $1
           )                  AS has_respected,
           EXISTS (
             SELECT 1 FROM saved_posts sp
             WHERE sp.post_id = p.id AND sp.user_id = $1
           )                  AS has_saved
         FROM posts p
         LEFT JOIN users u ON COALESCE(p.user_id, p.creator_id) = u.id
         WHERE TRUE
           ${SAFETY_WHERE}
           AND ${TAG_MATCH}
           ${typeClause}
         ${orderClause}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
      );

      const posts = result.rows.map(formatPost).filter(Boolean);

      return res.json({
        success: true,
        posts,
        pagination: {
          limit,
          offset,
          count: posts.length,
          hasMore: posts.length === limit,
        },
      });
    } catch (err) {
      console.error("[hashtags] posts error code=%s message=%s\n%s", err.code, err.message, err.stack);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  };

  // ── Route registrations ──────────────────────────────────────────────────
  router.get("/posts", authMiddleware, (req, res) => {
    req.params.tag = req.query.tag || req.query.q || req.query.hashtag || req.params.tag || "";
    if (!req.params.tag) {
      return res.status(400).json({ success: false, error: "Invalid tag name." });
    }
    return getTagPosts(req, res);
  });
  router.get("/:tag/summary", authMiddleware, getTagSummary);
  router.get("/:tag/posts", authMiddleware, getTagPosts);
  router.get("/:tag", authMiddleware, getTagSummary);

  return router;
};
