const express = require("express");

const authMiddleware = require("../middleware/auth");

const {
  getFeedCandidates,
} = require("../models/postModel");

const {
  getUserFeedProfile,
} = require("../models/feedProfileModel");

const {
  rankFeedPosts,
} = require("../utils/feedRanker");

const {
  getOrCreateExperiment,
  recordFeedImpressions,
} = require("../models/feedAnalyticsModel");

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const MIN_CANDIDATES = 200;
const MAX_CANDIDATES = 500;

const safeInteger = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed)
    ? parsed
    : fallback;
};

const normalizeLimit = (value) => {
  const parsed = safeInteger(
    value,
    DEFAULT_LIMIT
  );

  return Math.min(
    Math.max(parsed, 1),
    MAX_LIMIT
  );
};

const normalizeOffset = (value) => {
  const parsed = safeInteger(value, 0);
  return Math.max(parsed, 0);
};

const getCandidateLimit = (limit) => {
  return Math.min(
    Math.max(limit * 5, MIN_CANDIDATES),
    MAX_CANDIDATES
  );
};

const getUserId = (req) => {
  return (
    req.user?.id ||
    req.user?.userId ||
    req.user?.user_id ||
    null
  );
};

const getContentKey = (post) => {
  if (!post) {
    return "";
  }

  const values = [
    post.contentHash,
    post.videoHash,
    post.videoUrl,
    post.mediaUrl,
    post.id,
  ];

  const value = values.find(
    (item) =>
      item !== null &&
      item !== undefined &&
      String(item).trim()
  );

  return value
    ? String(value).trim().toLowerCase()
    : "";
};

const dedupePosts = (posts) => {
  const seen = new Set();

  return posts.filter((post) => {
    const key = getContentKey(post);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getExperiment = async (
  pool,
  userId
) => {
  try {
    const result =
      await getOrCreateExperiment(
        pool,
        userId
      );

    const variant =
      result?.variant === "level6"
        ? "level6"
        : "control";

    return {
      ...(result || {}),
      variant,
    };
  } catch (error) {
    console.error(
      "Feed experiment error:",
      error.message
    );

    return {
      variant: "control",
    };
  }
};

const getProfileSafely = async (
  pool,
  userId
) => {
  try {
    const profile =
      await getUserFeedProfile(
        pool,
        userId
      );

    return {
      ...(profile || {}),
      id: userId,
      userId,
    };
  } catch (error) {
    console.error(
      "Feed profile error:",
      error.message
    );

    return {
      id: userId,
      userId,
    };
  }
};

router.get(
  "/",
  authMiddleware,
  async (req, res) => {
    try {
      const pool = req.app.get("db");
      const userId = getUserId(req);

      if (!pool) {
        return res.status(500).json({
          success: false,
          error: "Database connection not found",
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Authenticated user not found",
        });
      }

      const limit = normalizeLimit(
        req.query.limit
      );

      const offset = normalizeOffset(
        req.query.offset
      );

      const candidateLimit =
        getCandidateLimit(limit);

      const experiment =
        await getExperiment(pool, userId);

      const rawCandidates =
        await getFeedCandidates(
          pool,
          userId,
          candidateLimit
        );

      const candidates = dedupePosts(
        Array.isArray(rawCandidates)
          ? rawCandidates.filter(Boolean)
          : []
      );

      let rankedPosts = [];
      let userProfile = {
        id: userId,
        userId,
      };

      if (experiment.variant === "level6") {
        userProfile =
          await getProfileSafely(
            pool,
            userId
          );

        rankedPosts =
          await rankFeedPosts(
            candidates,
            userProfile,
            Math.max(
              candidates.length,
              limit
            )
          );

        /*
         * Do not show watched posts during
         * normal ranking. Rewatch is used
         * only if no unseen candidates exist.
         */
        if (
          rankedPosts.length === 0 &&
          candidates.length > 0
        ) {
          rankedPosts =
            await rankFeedPosts(
              candidates,
              userProfile,
              Math.max(
                candidates.length,
                limit
              ),
              {
                allowRewatch: true,
              }
            );
        }
      } else {
        rankedPosts = candidates.map((post) => ({
          ...post,
          score: 0,
        }));
      }

      const posts = rankedPosts.slice(
        offset,
        offset + limit
      );

      /*
       * Analytics must not delay feed response.
       */
      if (posts.length > 0) {
        Promise.resolve(
          recordFeedImpressions(pool, {
            userId,
            variant: experiment.variant,
            posts,
            offset,
          })
        ).catch((analyticsError) => {
          console.error(
            "Feed impression error:",
            analyticsError.message
          );
        });
      }

      const rewatchFallbackUsed = posts.some(
        (post) => post.isRewatchFallback === true
      );

      return res.status(200).json({
        success: true,
        posts,

        feedState:
          posts.length > 0
            ? rewatchFallbackUsed
              ? "rewatch_fallback"
              : "ready"
            : "no_content",

        experiment: {
          variant: experiment.variant,
        },

        personalization: {
          enabled:
            experiment.variant === "level6",

          profileSource:
            experiment.variant === "level6"
              ? "follows_respects_watch_sessions_realtime_redis"
              : "chronological_control",
        },

        pagination: {
          limit,
          offset,
          count: posts.length,
          totalCandidates: rankedPosts.length,
          candidatePoolSize: candidates.length,
          hasMore:
            offset + posts.length <
            rankedPosts.length,
        },

        fallback: {
          rewatchUsed: rewatchFallbackUsed,
          needsStarterCatalog:
            posts.length === 0,
        },
      });
    } catch (error) {
      console.error(
        "GET /feed error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to load feed",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);

module.exports = router;