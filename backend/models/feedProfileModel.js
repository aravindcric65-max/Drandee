const NodeCache = require("node-cache");
const { getVelocity, getRealtimeProfile } = require("../utils/engagementVelocity");

// Cache for user profiles (5 mins TTL) - NEW!
const profileCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const safeNumber = (value, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const toId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const cleanTag = (value) => {
  return String(value || "").toLowerCase().trim();
};

const getUserFeedProfile = async (pool, userId) => {
  // Check cache first - NEW!
  const cached = profileCache.get(userId);
  if (cached) {
    return cached;
  }

  const [
    userResult,
    followingResult,
    respectsResult,
    watchResult,
    savedResult, // NEW!
    blocksOutResult,
    blocksInResult,
    mutesResult,
    notInterestedResult,
    reportsResult,
  ] = await Promise.all([
    pool.query(
      `
      SELECT
        id,
        favorite_tags,
        favorite_category,
        preferred_video_length,
        peak_activity_hour,
        avg_watch_session_duration,
        total_watch_time,
        current_velocity_score
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    ),
    pool.query(
      `SELECT following_id FROM follows WHERE follower_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT post_id FROM respects WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `
      SELECT
        post_id,
        watch_time,
        video_duration,
        completion_percent,
        rewatch_count,
        respected,
        is_shared,
        is_commented,
        last_watched_at
      FROM watch_sessions
      WHERE user_id = $1
      ORDER BY last_watched_at DESC NULLS LAST
      LIMIT 100
      `,
      [userId]
    ),
    // NEW! Saved posts
    pool.query(
      `SELECT post_id FROM saved_posts WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT blocked_id FROM user_blocks WHERE blocker_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT blocker_id FROM user_blocks WHERE blocked_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT muted_id FROM user_mutes WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT post_id FROM not_interested_posts WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT post_id FROM post_reports WHERE reporter_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] })),
  ]);

  const user = userResult.rows[0] || {};

  // Calculate weighted favorite tags - NEW!
  const favoriteTags = {};
  const rawFavoriteTags = parseJsonArray(user.favorite_tags);

  for (const tag of rawFavoriteTags) {
    const normalized = cleanTag(tag);
    if (normalized) {
      favoriteTags[normalized] = (favoriteTags[normalized] || 0) + 1;
    }
  }

  // Add weights from watch signals - NEW!
  for (const signal of watchResult.rows) {
    const post = await getPostById(pool, signal.post_id);
    if (post && Array.isArray(post.tags)) {
      for (const tag of post.tags) {
        const normalized = cleanTag(tag);
        let weight = 1;
        
        // Weight by engagement
        if (signal.completion_percent >= 75) weight += 1;
        if (signal.respected) weight += 2;
        if (signal.is_shared) weight += 3;
        if (signal.is_commented) weight += 2;
        
        favoriteTags[normalized] = (favoriteTags[normalized] || 0) + weight;
      }
    }
  }

  const following = followingResult.rows
    .map((row) => toId(row.following_id))
    .filter(Boolean);

  const respectedVideos = respectsResult.rows
    .map((row) => toId(row.post_id))
    .filter(Boolean);

  const watchedPosts = watchResult.rows
    .map((row) => toId(row.post_id))
    .filter(Boolean);

  // NEW! Saved posts
  const savedPosts = savedResult.rows
    .map((row) => toId(row.post_id))
    .filter(Boolean);

  const watchSignals = watchResult.rows.map((row) => ({
    postId: toId(row.post_id),
    watchTime: safeNumber(row.watch_time),
    videoDuration: safeNumber(row.video_duration),
    completionPercent: safeNumber(row.completion_percent),
    rewatchCount: safeNumber(row.rewatch_count),
    respected: row.respected === true,
    shared: row.is_shared === true,
    commented: row.is_commented === true,
  }));

  // Merge realtime data - NEW!
  const [velocity, realtime] = await Promise.all([
    getVelocity(userId),
    getRealtimeProfile(userId),
  ]);

  const profile = {
    id: toId(userId),
    following,
    respectedVideos,
    savedPosts, // NEW!
    watchedPosts,
    favoriteTags,
    favoriteCategory: cleanTag(user.favorite_category),
    preferredVideoLength: user.preferred_video_length || null,
    peakActivityHour: user.peak_activity_hour === null ? null : safeNumber(user.peak_activity_hour),
    avgWatchSessionDuration: safeNumber(user.avg_watch_session_duration),
    totalWatchTime: safeNumber(user.total_watch_time),
    currentVelocityScore: safeNumber(user.current_velocity_score),
    watchSignals,
    
    // Realtime data merge - NEW!
    currentVelocityScore: velocity.score,
    realtimeActions: realtime.actions,
    realtimePostScores: realtime.postScores,
    realtimeWatchedPosts: realtime.watchedPosts,
    
    /* Safety lists for in-memory filtering */
    blockedUserIds: blocksOutResult.rows
      .map((r) => toId(r.blocked_id))
      .filter(Boolean),
    blockedByUserIds: blocksInResult.rows
      .map((r) => toId(r.blocker_id))
      .filter(Boolean),
    mutedCreatorIds: mutesResult.rows
      .map((r) => toId(r.muted_id))
      .filter(Boolean),
    notInterestedPostIds: notInterestedResult.rows
      .map((r) => toId(r.post_id))
      .filter(Boolean),
    reportedPostIds: reportsResult.rows
      .map((r) => toId(r.post_id))
      .filter(Boolean),
  };

  // Cache for 5 mins - NEW!
  profileCache.set(userId, profile);

  return profile;
};

// Helper to get post by ID - NEW!
const getPostById = async (pool, postId) => {
  try {
    const result = await pool.query(
      `SELECT id, tags FROM posts WHERE id = $1 AND is_deleted = false LIMIT 1`,
      [postId]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
};

// Clear profile cache - NEW!
const clearProfileCache = (userId) => {
  profileCache.del(userId);
};

// Clear all profile cache - NEW!
const clearAllProfileCache = () => {
  profileCache.flushAll();
};

module.exports = {
  getUserFeedProfile,
  clearProfileCache, // NEW!
  clearAllProfileCache, // NEW!
};