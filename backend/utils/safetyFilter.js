const NodeCache = require("node-cache");

// Cache for safety lists (10 mins TTL) - NEW!
const safetyCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

/**
 * safetyFilter.js
 *
 * Server-side eligibility filter for the feed pipeline.
 * This module provides both SQL-level filtering (subqueries injected into
 * candidate queries) and post-query filtering (applied to already-fetched
 * candidate arrays).
 *
 * Every recommendation path MUST call filterCandidates() before ranking.
 */

/*
|--------------------------------------------------------------------------
| Configuration - NEW!
|--------------------------------------------------------------------------
*/
const BLOCKED_KEYWORDS = [
  "spam",
  "hate",
  "violence",
  "nsfw",
  "scam",
  "fake",
  "misleading",
];

const SENSITIVITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/
const toId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const cleanString = (value) => {
  return String(value || "").trim().toLowerCase();
};

/*
|--------------------------------------------------------------------------
| SQL safety subqueries
|
| These WHERE clauses are designed to be appended to the base feed SELECT.
| $1 is always the requesting userId.
|--------------------------------------------------------------------------
*/
const getSafetyWhereClause = () => {
  return `
    /* Safety: exclude deleted posts */
    AND (p.is_deleted IS NOT TRUE)

    /* Safety: only approved moderation status */
    AND (p.moderation_status IS NULL OR p.moderation_status = 'approved')

    /* Safety: only licensed content */
    AND (p.rights_status = 'licensed' OR p.rights_status IS NULL)

    /* Safety: exclude rights-expired content */
    AND (p.rights_expires_at IS NULL OR p.rights_expires_at > NOW())

    /* Safety: exclude posts by users this user has blocked */
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE ub.blocker_id = $1 AND ub.blocked_id = p.user_id
    )

    /* Safety: exclude posts by users who blocked this user */
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub2
      WHERE ub2.blocker_id = p.user_id AND ub2.blocked_id = $1
    )

    /* Safety: exclude posts by muted creators */
    AND NOT EXISTS (
      SELECT 1 FROM user_mutes um
      WHERE um.user_id = $1 AND um.muted_id = p.user_id
    )

    /* Safety: exclude not-interested posts */
    AND NOT EXISTS (
      SELECT 1 FROM not_interested_posts nip
      WHERE nip.user_id = $1 AND nip.post_id = p.id
    )

    /* Safety: exclude posts this user reported */
    AND NOT EXISTS (
      SELECT 1 FROM post_reports pr
      WHERE pr.reporter_id = $1 AND pr.post_id = p.id
    )

    /* Safety: exclude private posts from non-followed creators */
    AND (
      p.is_private IS NOT TRUE
      OR EXISTS (
        SELECT 1 FROM follows f_priv
        WHERE f_priv.follower_id = $1 AND f_priv.following_id = p.user_id
      )
    )

    /* Safety: age restrictions - NEW! */
    AND (
      p.age_restriction IS NULL OR
      p.age_restriction = 0 OR
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = $1 AND u.age_verified = true AND u.age >= p.age_restriction
      )
    )
  `;
};

/*
|--------------------------------------------------------------------------
| In-memory safety filter
|
| Applied to already-fetched candidate arrays as a second pass.
| This catches edge cases where SQL columns may not exist yet
| (gradual migration) or where the candidate came from a cache.
|--------------------------------------------------------------------------
*/

/**
 * Loads the user's safety lists from the database.
 * Returns sets of IDs for fast O(1) lookup.
 * Uses caching to reduce database load. - NEW!
 */
const loadUserSafetyLists = async (pool, userId) => {
  if (!pool || !userId) {
    return {
      blockedUserIds: new Set(),
      blockedByUserIds: new Set(),
      mutedCreatorIds: new Set(),
      notInterestedPostIds: new Set(),
      reportedPostIds: new Set(),
      softBlockedUserIds: new Set(),
      blockedKeywords: [],
      sensitivityPreference: "medium",
      userAge: 0,
      ageVerified: false,
    };
  }

  // Check cache first - NEW!
  const cached = safetyCache.get(userId);
  if (cached) {
    return cached;
  }

  try {
    const [
      blocksOut,
      blocksIn,
      mutes,
      notInterested,
      reports,
      userResult,
    ] = await Promise.all([
      pool.query(
        `SELECT blocked_id FROM user_blocks WHERE blocker_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT blocker_id FROM user_blocks WHERE blocked_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT muted_id FROM user_mutes WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT post_id FROM not_interested_posts WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT post_id FROM post_reports WHERE reporter_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id FROM users WHERE id = $1`,
        [userId]
      ),
    ]);

    // Separate hard and soft blocks - NEW!
    const blockedUserIds = new Set();
    const softBlockedUserIds = new Set();

    blocksOut.rows.forEach((r) => {
      const blockId = toId(r.blocked_id);
      blockedUserIds.add(blockId);
    });

    const safetyLists = {
      blockedUserIds: new Set(blocksOut.rows.map((r) => toId(r.blocked_id))),
      blockedByUserIds: new Set(blocksIn.rows.map((r) => toId(r.blocker_id))),
      mutedCreatorIds: new Set(mutes.rows.map((r) => toId(r.muted_id))),
      notInterestedPostIds: new Set(notInterested.rows.map((r) => toId(r.post_id))),
      reportedPostIds: new Set(reports.rows.map((r) => toId(r.post_id))),
      softBlockedUserIds,
      blockedKeywords: userResult.rows[0]?.blocked_keywords || [],
      sensitivityPreference: userResult.rows[0]?.sensitivity_preference || "medium",
      userAge: userResult.rows[0]?.age || 0,
      ageVerified: userResult.rows[0]?.age_verified || false,
    };

    // Cache for 10 mins - NEW!
    safetyCache.set(userId, safetyLists);

    return safetyLists;
  } catch (error) {
    console.error("Safety list load error:", error.message);

    return {
      blockedUserIds: new Set(),
      blockedByUserIds: new Set(),
      mutedCreatorIds: new Set(),
      notInterestedPostIds: new Set(),
      reportedPostIds: new Set(),
      softBlockedUserIds: new Set(),
      blockedKeywords: [],
      sensitivityPreference: "medium",
      userAge: 0,
      ageVerified: false,
    };
  }
};

/**
 * Check if post contains blocked keywords - NEW!
 */
const containsBlockedKeywords = (post, blockedKeywords) => {
  if (!blockedKeywords || blockedKeywords.length === 0) {
    return false;
  }

  const caption = cleanString(post.caption || "");
  const hashtags = (post.tags || []).map(cleanString);
  const content = `${caption} ${hashtags.join(" ")}`;

  return blockedKeywords.some((keyword) => {
    const cleanKeyword = cleanString(keyword);
    return content.includes(cleanKeyword);
  });
};

/**
 * Check age restriction - NEW!
 */
const checkAgeRestriction = (post, userAge, ageVerified) => {
  const postAge = post.age_restriction || 0;

  if (postAge === 0) {
    return true; // No restriction
  }

  if (!ageVerified) {
    return postAge === 0; // Only show unrestricted content
  }

  return userAge >= postAge;
};

/**
 * Check sensitivity level - NEW!
 */
const checkSensitivity = (post, sensitivityPreference) => {
  const postSensitivity = post.sensitivity_level || "low";

  if (sensitivityPreference === "low") {
    return true; // Show all
  }

  if (sensitivityPreference === "medium") {
    return postSensitivity !== "high"; // Hide high sensitivity
  }

  if (sensitivityPreference === "high") {
    return postSensitivity === "low"; // Only low sensitivity
  }

  return true;
};

/**
 * Filters an array of candidate posts using in-memory safety lists.
 *
 * @param {Array} candidates - Array of post objects
 * @param {Object} safetyLists - Result of loadUserSafetyLists()
 * @returns {Array} - Filtered candidates
 */
const filterCandidates = (candidates, safetyLists) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  if (!safetyLists) {
    return candidates.filter(Boolean);
  }

  const {
    blockedUserIds = new Set(),
    blockedByUserIds = new Set(),
    mutedCreatorIds = new Set(),
    notInterestedPostIds = new Set(),
    reportedPostIds = new Set(),
    softBlockedUserIds = new Set(),
    blockedKeywords = [],
    sensitivityPreference = "medium",
    userAge = 0,
    ageVerified = false,
  } = safetyLists;

  return candidates.filter((post) => {
    if (!post) {
      return false;
    }

    const postId = toId(post.id);
    const creatorId = toId(post.creatorId);

    // Exclude deleted posts
    if (post.isDeleted === true) {
      return false;
    }

    // Exclude moderation-rejected posts
    if (post.moderationStatus && post.moderationStatus !== "approved") {
      return false;
    }

    // Exclude non-licensed content
    if (post.rightsStatus && post.rightsStatus !== "licensed") {
      return false;
    }

    // Exclude rights-expired content
    if (post.rightsExpiresAt) {
      const expiryTime = new Date(post.rightsExpiresAt).getTime();
      if (Number.isFinite(expiryTime) && expiryTime < Date.now()) {
        return false;
      }
    }

    // Exclude posts by blocked creators (hard blocks)
    if (blockedUserIds.has(creatorId)) {
      return false;
    }

    // Exclude posts by users who blocked this user
    if (blockedByUserIds.has(creatorId)) {
      return false;
    }

    // Exclude posts by muted creators
    if (mutedCreatorIds.has(creatorId)) {
      return false;
    }

    // Exclude not-interested posts
    if (notInterestedPostIds.has(postId)) {
      return false;
    }

    // Exclude reported posts
    if (reportedPostIds.has(postId)) {
      return false;
    }

    // Mark soft-blocked posts (reduce score, don't exclude) - NEW!
    if (softBlockedUserIds.has(creatorId)) {
      post.softBlocked = true;
      // Don't exclude, just mark for score reduction
    }

    // Check blocked keywords - NEW!
    if (containsBlockedKeywords(post, blockedKeywords)) {
      return false;
    }

    // Check age restriction - NEW!
    if (!checkAgeRestriction(post, userAge, ageVerified)) {
      return false;
    }

    // Check sensitivity level - NEW!
    if (!checkSensitivity(post, sensitivityPreference)) {
      return false;
    }

    return true;
  });
};

/**
 * Clear safety cache for a user - NEW!
 */
const clearSafetyCache = (userId) => {
  safetyCache.del(userId);
};

/**
 * Clear all safety cache - NEW!
 */
const clearAllSafetyCache = () => {
  safetyCache.flushAll();
};

module.exports = {
  getSafetyWhereClause,
  loadUserSafetyLists,
  filterCandidates,
  clearSafetyCache, // NEW!
  clearAllSafetyCache, // NEW!
  containsBlockedKeywords, // NEW!
  checkAgeRestriction, // NEW!
  checkSensitivity, // NEW!
};