const {
  getSafetyWhereClause,
} = require("../utils/safetyFilter");
const { normalizeMediaUrl } = require("../utils/mediaUrl");


const safeInteger = (value, fallback = 0) => {
  const result = parseInt(value, 10);

  return Number.isFinite(result) ? result : fallback;
};


const safeFloat = (value, fallback = 0) => {
  const result = parseFloat(value);

  return Number.isFinite(result) ? result : fallback;
};


const safeBoolean = (value) => {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1"
  );
};


const safeTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map((tag) => String(tag).trim())
          .filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  return [];
};


const determineContentType = (row) => {
  // Check database content_type first
  if (row.content_type) {
    if (row.content_type === 'photo') return 'image';
    return row.content_type;
  }

  // Fallback: detect from fields
  const mediaUrl = row.video_url || row.content?.videoUrl;
  const hasVideo = row.type === 'video' || 
                   row.post_type === 'video' || 
                   row.type === 'reel' ||
                   (mediaUrl && mediaUrl.match(/\.(mp4|mov|webm)$/i));
  
  const hasText = row.type === 'text' || 
                  row.type === 'discussion' ||
                  row.post_type === 'text' || 
                  row.post_type === 'discussion';

  if (row.type === 'carousel' || row.post_type === 'carousel') return 'carousel';
  if (hasVideo) return 'video';
  if (hasText) return 'text';
  return 'image';
};


const formatPost = (row) => {
  if (!row) {
    return null;
  }

  const contentType = determineContentType(row);

  return {
    id: row.id,
    type: contentType,
    post_type: contentType,
    content_type: contentType,
    
    // Legacy flat fields for backward compatibility
    creatorId: row.user_id ?? row.creator_id ?? null,
    creatorName: row.creator_display_name || row.creator_name || "",
    videoUrl: normalizeMediaUrl(row.video_url),
    imageUrl: normalizeMediaUrl(row.image_url),

    // Canonical nested schema for unified Home/Profile/Upload
    content: {
      videoUrl: normalizeMediaUrl(row.video_url),
      imageUrl: normalizeMediaUrl(row.image_url),
      thumbnailUrl: normalizeMediaUrl(row.thumbnail_url),
      caption: row.caption || "",
      text: row.overlay_text || row.caption || "",
    },
    
    creator: {
      id: row.user_id ?? row.creator_id ?? null,
      username: row.creator_username || "",
      displayName: row.creator_display_name || row.creator_name || "",
      avatarUrl: normalizeMediaUrl(row.creator_avatar),
      isVerified: row.creator_identity_level === 'Icon' || row.creator_identity_level === 'Legend',
      followerCount: 0
    },

    stats: {
      respects: safeInteger(row.total_respects, 0) || safeInteger(row.respects, 0),
      comments: safeInteger(row.comment_count, 0) || safeInteger(row.comments, 0),
      shares: safeInteger(row.share_count, 0) || safeInteger(row.shares, 0),
      saves: safeInteger(row.save_count, 0) || safeInteger(row.saves, 0),
      views: safeInteger(row.watch_count, 0) || safeInteger(row.views, 0),
      totalWatchTime: safeInteger(row.total_watch_time, 0),
    },

    // Flat engagement fields for backward compatibility with feedRanker
    totalRespects: safeInteger(row.total_respects, 0) || safeInteger(row.respects, 0),
    comments: safeInteger(row.comment_count, 0) || safeInteger(row.comments, 0),
    shares: safeInteger(row.share_count, 0) || safeInteger(row.shares, 0),
    saves: safeInteger(row.save_count, 0) || safeInteger(row.saves, 0),
    watchCount: safeInteger(row.watch_count, 0) || safeInteger(row.views, 0),

    caption: row.caption || "",
    tags: safeTags(row.tags),
    hashtags: safeTags(row.tags),
    category: row.category || null,
    language: row.language || null,

    overlayText: row.overlay_text || null,
    textPosition: row.text_position || "center",
    startTime: safeFloat(row.start_time, 0),
    endTime: row.end_time === null || row.end_time === undefined ? null : safeFloat(row.end_time, 0),
    duration: safeInteger(row.duration, 0),
    avgCompletionRate: safeFloat(row.avg_completion_rate, 0),

    createdAt: row.created_at,
    hasRespected: Boolean(row.has_respected),
    hasSaved: Boolean(row.has_saved),
    isFollowingCreator: Boolean(row.is_following_creator),
    
    privacy: {
      hideRespectCount: safeBoolean(row.hide_respect_count ?? row.hideRespectCount ?? false),
      hideShareCount: safeBoolean(row.hide_share_count ?? row.hideShareCount ?? false),
      commentsEnabled: safeBoolean(row.comments_enabled ?? row.commentsEnabled ?? true),
      reuseEnabled: safeBoolean(row.reuse_enabled ?? row.reuseEnabled ?? true)
    }
  };
};


const normalizeLimit = (value, fallback = 20) => {
  const parsed = parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), 50);
};


const normalizeCandidateLimit = (
  value,
  fallback = 200
) => {
  const parsed = parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 20), 500);
};


const normalizeOffset = (value) => {
  const parsed = parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
};


/*
|--------------------------------------------------------------------------
| SQL helpers
|--------------------------------------------------------------------------
*/


const feedSelect = `
  SELECT
    p.*,
    u.username AS creator_username,
    u.name AS creator_display_name,
    u.profile_pic AS creator_avatar,
    u.identity_level AS creator_identity_level,


    EXISTS (
      SELECT 1
      FROM respects r
      WHERE r.post_id = p.id
        AND r.user_id = $1
    ) AS has_respected,


    EXISTS (
      SELECT 1
      FROM follows f
      WHERE f.follower_id = $1
        AND f.following_id = p.user_id
    ) AS is_following_creator


  FROM posts p
  LEFT JOIN users u ON p.user_id = u.id
`;


/*
|--------------------------------------------------------------------------
| Get feed candidates
|--------------------------------------------------------------------------
*/


const getFeedCandidates = async (
  pool,
  userId,
  candidateLimit = 200
) => {
  if (!pool) {
    throw new Error("Database pool is required");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  const safeLimit = normalizeCandidateLimit(
    candidateLimit
  );

  const result = await pool.query(
    `
    ${feedSelect}
    WHERE p.user_id <> $1 AND p.is_deleted = false
    ${getSafetyWhereClause()}
    ORDER BY p.created_at DESC NULLS LAST, p.id DESC
    LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows
    .map(formatPost)
    .filter((post) => post !== null);
};


/*
|--------------------------------------------------------------------------
| Get normal feed posts
|--------------------------------------------------------------------------
*/


const getFeedPosts = async (
  pool,
  userId,
  limit = 20,
  offset = 0
) => {
  if (!pool) {
    throw new Error("Database pool is required");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const result = await pool.query(
    `
    ${feedSelect}
    WHERE p.user_id <> $1 AND p.is_deleted = false
    ${getSafetyWhereClause()}
    ORDER BY p.created_at DESC NULLS LAST, p.id DESC
    LIMIT $2
    OFFSET $3
    `,
    [
      userId,
      safeLimit,
      safeOffset,
    ]
  );

  return result.rows
    .map(formatPost)
    .filter((post) => post !== null);
};


/*
|--------------------------------------------------------------------------
| Get posts by creator
|--------------------------------------------------------------------------
*/


const getPostsByCreator = async (
  pool,
  creatorId,
  userId = null,
  limit = 50
) => {
  if (!pool) {
    throw new Error("Database pool is required");
  }

  if (!creatorId) {
    throw new Error("creatorId is required");
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  const result = await pool.query(
    `
    SELECT
      p.*,


      CASE
        WHEN $2::int IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM respects r
          WHERE r.post_id = p.id
            AND r.user_id = $2
        )
      END AS has_respected,


      CASE
        WHEN $2::int IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM follows f
          WHERE f.follower_id = $2
            AND f.following_id = p.user_id
        )
      END AS is_following_creator


    FROM posts p
    WHERE p.user_id = $1 AND p.is_deleted = false
    ORDER BY p.created_at DESC NULLS LAST, p.id DESC
    LIMIT $3
    `,
    [creatorId, userId, safeLimit]
  );

  return result.rows
    .map(formatPost)
    .filter((post) => post !== null);
};


/*
|--------------------------------------------------------------------------
| Get one post
|--------------------------------------------------------------------------
*/


const getPostById = async (
  pool,
  postId,
  userId = null
) => {
  if (!pool) {
    throw new Error("Database pool is required");
  }

  if (!postId) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      p.*,


      CASE
        WHEN $2::int IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM respects r
          WHERE r.post_id = p.id
            AND r.user_id = $2
        )
      END AS has_respected,


      CASE
        WHEN $2::int IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM follows f
          WHERE f.follower_id = $2
            AND f.following_id = p.user_id
        )
      END AS is_following_creator


    FROM posts p
    WHERE p.id = $1 AND p.is_deleted = false
    LIMIT 1
    `,
    [postId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatPost(result.rows[0]);
};


/*
|--------------------------------------------------------------------------
| Create post
|--------------------------------------------------------------------------
*/


const createPost = async (pool, data = {}) => {
  if (!pool) {
    throw new Error("Database pool is required");
  }

  const {
    creatorId,
    creatorName,
    videoUrl,
    caption,
    tags,
    overlayText,
    textPosition,
    startTime,
    endTime,
    region,
  } = data;

  if (!creatorId) {
    throw new Error("creatorId is required");
  }

  if (!creatorName) {
    throw new Error("creatorName is required");
  }

  if (!videoUrl) {
    throw new Error("videoUrl is required");
  }

  const postTags = Array.isArray(tags)
    ? tags
        .map((tag) => String(tag).trim())
        .filter(Boolean)
    : [];

  const result = await pool.query(
    `
    INSERT INTO posts (
      user_id,
      creator_id,
      creator_name,
      video_url,
      caption,
      tags,
      overlay_text,
      text_position,
      start_time,
      end_time,
      region
    )
    VALUES (
      $1,
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10
    )
    RETURNING *
    `,
    [
      creatorId,
      creatorName,
      normalizeMediaUrl(videoUrl),
      caption || null,
      postTags,
      overlayText || null,
      textPosition || "center",
      safeFloat(startTime, 0),
      endTime === undefined ||
      endTime === null
        ? null
        : safeFloat(endTime, 0),
      region || "local",
    ]
  );

  return formatPost({
    ...result.rows[0],
    has_respected: false,
    is_following_creator: false,
  });
};


module.exports = {
  formatPost,
  getFeedPosts,
  getFeedCandidates,
  getPostsByCreator,
  getPostById,
  createPost,
};