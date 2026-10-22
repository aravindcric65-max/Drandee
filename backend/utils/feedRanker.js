const {
  getVelocity,
  getRealtimeProfile,
  getFeedAdjustment,
} = require("./engagementVelocity");

const toNumber = (value, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const toId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const cleanTag = (value) => {
  return String(value || "").toLowerCase().trim();
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags.map(cleanTag).filter(Boolean);
};

const normalizeCompletion = (value) => {
  const completion = toNumber(value, 0);
  if (completion > 0 && completion <= 1) {
    return completion * 100;
  }
  return Math.min(Math.max(completion, 0), 100);
};

const normalizeLimit = (value, fallback = 20) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 1), 200);
};

const toSet = (values) => {
  if (!Array.isArray(values)) {
    return new Set();
  }
  return new Set(
    values
      .map(toId)
      .map((value) => value.trim())
      .filter(Boolean)
  );
};

const increment = (object, key, amount = 1) => {
  object[key] = (object[key] || 0) + amount;
};

const getContentKey = (post) => {
  if (!post) {
    return "";
  }
  const candidates = [
    post.contentHash,
    post.videoHash,
    post.videoUrl,
    post.mediaUrl,
    post.id,
  ];
  const value = candidates.find(
    (item) =>
      item !== null &&
      item !== undefined &&
      String(item).trim()
  );
  return value ? String(value).trim().toLowerCase() : "";
};

const uniquePosts = (posts) => {
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

const buildUserProfile = (user = {}, posts = []) => {
  const respectedVideos = toSet(user.respectedVideos);
  const savedPosts = toSet(user.savedPosts);
  const following = toSet(user.following);
  const watchedPosts = toSet(user.watchedPosts);
  const realtimeWatchedPosts = toSet(user.realtimeWatchedPosts);

  for (const postId of realtimeWatchedPosts) {
    watchedPosts.add(postId);
  }

  const favoriteTags = {};
  const favoriteCreators = {};
  const favoriteCategories = {};

  if (user.favoriteTags && typeof user.favoriteTags === "object") {
    for (const [tag, value] of Object.entries(user.favoriteTags)) {
      const normalized = cleanTag(tag);
      if (!normalized) {
        continue;
      }
      favoriteTags[normalized] = toNumber(value, 1);
    }
  }

  const favoriteCategory = cleanTag(user.favoriteCategory);
  if (favoriteCategory) {
    favoriteCategories[favoriteCategory] = 5;
  }

  for (const post of posts) {
    if (!post) {
      continue;
    }
    const postId = toId(post.id);
    const interacted =
      respectedVideos.has(postId) ||
      savedPosts.has(postId);
    if (!interacted) {
      continue;
    }
    const creatorId = toId(post.creatorId);
    if (creatorId) {
      increment(favoriteCreators, creatorId);
    }
    for (const tag of normalizeTags(post.tags)) {
      increment(favoriteTags, tag);
    }
    const category = cleanTag(post.category);
    if (category) {
      increment(favoriteCategories, category);
    }
  }

  return {
    respectedVideos,
    savedPosts,
    following,
    watchedPosts,
    favoriteTags,
    favoriteCreators,
    favoriteCategories,
    preferredVideoLength: user.preferredVideoLength || null,
    preferredLanguage: user.preferredLanguage || user.language || null,
    peakActivityHour: user.peakActivityHour,
    watchSignals: Array.isArray(user.watchSignals) ? user.watchSignals : [],
    realtimeActions: user.realtimeActions || {},
    realtimePostScores: user.realtimePostScores || {},
  };
};

const calculateBaseScore = (post, profile) => {
  if (!post) {
    return 0;
  }

  const creatorId = toId(post.creatorId);
  const category = cleanTag(post.category);
  const respects = Math.max(toNumber(post.totalRespects, 0), 0);
  const comments = Math.max(toNumber(post.comments, 0), 0);
  const shares = Math.max(toNumber(post.shares, 0), 0);
  const saves = Math.max(toNumber(post.saves, 0), 0);
  const watches = Math.max(toNumber(post.watchCount, 0), 1);
  const completion = normalizeCompletion(post.avgCompletionRate);
  const duration = Math.max(toNumber(post.duration, 0), 0);

  let score = 0;

  // 1. Creator Affinity (0-320 pts)
  const creatorAffinity = profile.favoriteCreators[creatorId] || 0;
  score += Math.min(creatorAffinity * 80, 320);

  // 2. Following Boost (0 or 300 pts)
  if (profile.following.has(creatorId)) {
    score += 300;
  }

  // 3. Tag Affinity (0-140 pts per tag)
  for (const tag of normalizeTags(post.tags)) {
    const affinity = profile.favoriteTags[tag] || 0;
    score += Math.min(affinity * 35, 140);
  }

  // 4. Category Affinity (0-200 pts)
  const categoryAffinity = profile.favoriteCategories[category] || 0;
  score += Math.min(categoryAffinity * 40, 200);

  // 5. Video Length Preference (0 or 100 pts)
  const preferredLength = String(profile.preferredVideoLength || "").toLowerCase();
  if (preferredLength === "short" && duration > 0 && duration <= 30) {
    score += 100;
  }
  if (preferredLength === "medium" && duration > 30 && duration <= 90) {
    score += 100;
  }
  if (preferredLength === "long" && duration > 90) {
    score += 100;
  }

  // 6. Language Match (0 or 220 pts)
  const preferredLanguage = cleanTag(profile.preferredLanguage);
  const postLanguage = cleanTag(post.language);
  if (preferredLanguage && postLanguage && preferredLanguage === postLanguage) {
    score += 220;
  }

  // 7. Completion Rate (0-500 pts)
  score += Math.min(completion * 5, 500);

  // 8. Save Rate (0-250 pts)
  const saveRate = saves / watches;
  score += Math.min(saveRate * 500, 250);

  // 9. Share Rate (0-300 pts)
  const shareRate = shares / watches;
  score += Math.min(shareRate * 700, 300);

  // 10. Comment Rate (0-150 pts)
  const commentRate = comments / watches;
  score += Math.min(commentRate * 300, 150);

  // 11. Watch Signals (0-510 pts)
  const matchingSignal = profile.watchSignals.find(
    (signal) => toId(signal?.postId) === toId(post.id)
  );
  if (matchingSignal) {
    const watchedCompletion = normalizeCompletion(matchingSignal.completionPercent);
    const rewatchCount = Math.max(toNumber(matchingSignal.rewatchCount, 0), 0);
    score += Math.min(watchedCompletion * 2, 160);
    score += Math.min(rewatchCount * 40, 120);
    if (matchingSignal.shared) {
      score += 120;
    }
    if (matchingSignal.commented) {
      score += 90;
    }
    if (matchingSignal.respected) {
      score += 140;
    }
  }

  // 12. Recency Boost (0-250 pts)
  const createdAt = new Date(post.createdAt).getTime();
  let ageHours = 1;
  if (Number.isFinite(createdAt)) {
    ageHours = Math.max(1, (Date.now() - createdAt) / (1000 * 60 * 60));
  }
  score += Math.max(0, 250 - ageHours * 3);

  // 13. Freshness Boost (< 1 hour) - NEW!
  if (ageHours < 1) {
    score += 200;
  }

  // 14. Hidden Gem (0 or 180 pts)
  if (respects < 1000 && completion >= 60) {
    score += 180;
  }

  // 15. Realtime Score (0-120 pts)
  const realtimePostScore = toNumber(profile.realtimePostScores[toId(post.id)], 0);
  score += Math.min(realtimePostScore * 8, 120);

  // 16. Viral Penalty (1M+ respects) - NEW!
  let viralPenalty = 0;
  if (respects > 1000000) {
    viralPenalty = 400;
  } else if (respects > 500000) {
    viralPenalty = 250;
  } else if (respects > 100000) {
    viralPenalty = 100;
  }
  score -= viralPenalty;

  // 17. Age Penalty (72+ hours) - NEW!
  if (ageHours > 72) {
    const agePenalty = Math.min(250, (ageHours - 72) * 4);
    score -= agePenalty;
  }

  // 18. Watched Penalty - NEW!
  if (profile.watchedPosts.has(toId(post.id))) {
    score -= 600;
  }

  return score;
};

const getSafeVelocity = async (userId) => {
  const fallback = {
    score: 0,
    intensity: "low",
    skipRate: 0,
  };
  if (!userId) {
    return fallback;
  }
  try {
    const result = await getVelocity(userId);
    if (!result || typeof result !== "object") {
      return fallback;
    }
    return {
      ...fallback,
      ...result,
      score: toNumber(result.score, 0),
      skipRate: toNumber(result.skipRate, 0),
      intensity: result.intensity || "low",
    };
  } catch (error) {
    console.error("Feed velocity error:", error.message);
    return fallback;
  }
};

const getSafeAdjustment = (velocity, post, isFollowingCreator) => {
  try {
    const result = getFeedAdjustment(velocity, {
      ...post,
      isFollowingCreator,
    });
    return toNumber(result, 0);
  } catch (error) {
    console.error("Feed adjustment error:", error.message);
    return 0;
  }
};

const getSafeRealtimeProfile = async (userId) => {
  const fallback = {
    actions: {},
    postScores: {},
    watchedPosts: [],
  };
  if (!userId) {
    return fallback;
  }
  try {
    const result = await getRealtimeProfile(userId);
    if (!result || typeof result !== "object") {
      return fallback;
    }
    return {
      ...fallback,
      ...result,
      actions: result.actions || {},
      postScores: result.postScores || {},
      watchedPosts: Array.isArray(result.watchedPosts) ? result.watchedPosts : [],
    };
  } catch (error) {
    console.error("Realtime profile error:", error.message);
    return fallback;
  }
};

const rankFeedPosts = async (posts, user = {}, limit = 20, options = {}) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const safeLimit = normalizeLimit(limit);
  const uniqueCandidatePosts = uniquePosts(posts.filter(Boolean));

  if (uniqueCandidatePosts.length === 0) {
    return [];
  }

  const realtimeProfile = await getSafeRealtimeProfile(user.id);
  const mergedUser = {
    ...user,
    realtimeActions: realtimeProfile.actions,
    realtimePostScores: realtimeProfile.postScores,
    realtimeWatchedPosts: realtimeProfile.watchedPosts,
  };

  const profile = buildUserProfile(mergedUser, uniqueCandidatePosts);
  const velocity = await getSafeVelocity(user.id);
  const includeDebugScore = options.includeDebugScore === true;
  const allowRewatch = options.allowRewatch === true;

  const eligiblePosts = uniqueCandidatePosts.filter((post) => {
    if (allowRewatch) {
      return true;
    }
    return !profile.watchedPosts.has(toId(post.id));
  });

  if (eligiblePosts.length === 0) {
    return [];
  }

  const scored = eligiblePosts.map((post) => {
    const baseScore = calculateBaseScore(post, profile);
    const creatorId = toId(post.creatorId);
    const isFollowingCreator = profile.following.has(creatorId);
    const velocityAdjustment = getSafeAdjustment(velocity, post, isFollowingCreator);
    const wasWatched = profile.watchedPosts.has(toId(post.id));
    const finalScore = Math.round(baseScore + velocityAdjustment);

    const rankedPost = {
      ...post,
      score: finalScore,
      ...(allowRewatch && wasWatched ? { isRewatchFallback: true } : {}),
    };

    if (includeDebugScore) {
      rankedPost.scoreBreakdown = {
        baseScore: Math.round(baseScore),
        velocityAdjustment: Math.round(velocityAdjustment),
        velocityIntensity: velocity.intensity,
        watched: wasWatched,
      };
    }

    return rankedPost;
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateB !== dateA) {
      return dateB - dateA;
    }
    return toId(a.id).localeCompare(toId(b.id));
  });

  const result = [];
  const creatorCounts = {};
  const categoryCounts = {};
  const selectedKeys = new Set();

  for (const post of scored) {
    if (result.length >= safeLimit) {
      break;
    }
    const contentKey = getContentKey(post);
    if (!contentKey || selectedKeys.has(contentKey)) {
      continue;
    }
    const creatorId = toId(post.creatorId) || "unknown";
    const category = cleanTag(post.category) || "general";
    const creatorCount = creatorCounts[creatorId] || 0;
    const categoryCount = categoryCounts[category] || 0;
    if (creatorCount >= 2) {
      continue;
    }
    if (categoryCount >= 5) {
      continue;
    }
    result.push(post);
    selectedKeys.add(contentKey);
    creatorCounts[creatorId] = creatorCount + 1;
    categoryCounts[category] = categoryCount + 1;
  }

  if (result.length < safeLimit) {
    for (const post of scored) {
      if (result.length >= safeLimit) {
        break;
      }
      const contentKey = getContentKey(post);
      if (!contentKey || selectedKeys.has(contentKey)) {
        continue;
      }
      result.push(post);
      selectedKeys.add(contentKey);
    }
  }

  return result.slice(0, safeLimit);
};

module.exports = {
  rankFeedPosts,
  buildUserProfile,
  calculateBaseScore,
};