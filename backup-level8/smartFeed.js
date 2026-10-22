const toId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const cleanTag = (value) => {
  return String(value || "").toLowerCase().trim();
};

const normalizeCompletion = (value) => {
  const completion = Number(value) || 0;

  if (completion > 0 && completion <= 1) {
    return completion * 100;
  }

  return Math.min(
    Math.max(completion, 0),
    100
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

export const getSmartFeed = (
  posts,
  user = {},
  options = {}
) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const now = Date.now();

  const following = new Set(
    Array.isArray(user.following)
      ? user.following.map(toId)
      : []
  );

  const watchedPostIds = new Set(
    Array.isArray(user.watchedPosts)
      ? user.watchedPosts.map(toId)
      : []
  );

  const respectedVideos = new Set(
    Array.isArray(user.respectedVideos)
      ? user.respectedVideos.map(toId)
      : []
  );

  const savedPosts = new Set(
    Array.isArray(user.savedPosts)
      ? user.savedPosts.map(toId)
      : []
  );

  const interactedPostIds = new Set([
    ...respectedVideos,
    ...savedPosts,
  ]);

  const unique = dedupePosts(
    posts.filter(Boolean)
  );

  if (unique.length === 0) {
    return [];
  }

  const unseenPosts = unique.filter(
    (post) =>
      !watchedPostIds.has(toId(post.id))
  );

  /*
   * Normal behavior: show unseen posts.
   * Last-resort behavior: allow rewatch only
   * if every available post was watched.
   */
  const sourcePosts =
    unseenPosts.length > 0
      ? unseenPosts
      : unique.map((post) => ({
          ...post,
          isRewatchFallback: true,
        }));

  const favoriteTags = {};
  const favoriteCreators = {};
  const favoriteCategories = {};

  unique.forEach((post) => {
    const postId = toId(post.id);

    if (!interactedPostIds.has(postId)) {
      return;
    }

    const creatorId = toId(post.creatorId);

    if (creatorId) {
      favoriteCreators[creatorId] =
        (favoriteCreators[creatorId] || 0) + 1;
    }

    if (Array.isArray(post.tags)) {
      post.tags.forEach((tag) => {
        const normalized = cleanTag(tag);

        if (normalized) {
          favoriteTags[normalized] =
            (favoriteTags[normalized] || 0) + 1;
        }
      });
    }

    const category = cleanTag(post.category);

    if (category) {
      favoriteCategories[category] =
        (favoriteCategories[category] || 0) + 1;
    }
  });

  const scoredPosts = sourcePosts.map((post) => {
    const respects =
      Number(post.totalRespects) || 0;

    const comments =
      Number(post.comments) || 0;

    const shares =
      Number(post.shares) || 0;

    const saves =
      Number(post.saves) || 0;

    const watchCount = Math.max(
      Number(post.watchCount) || 0,
      1
    );

    const completion = normalizeCompletion(
      post.avgCompletionRate
    );

    let score = 0;
    const breakdown = {};

    const creatorId = toId(post.creatorId);

    const creatorBoost = Math.min(
      300,
      (favoriteCreators[creatorId] || 0) * 60
    );

    score += creatorBoost;
    breakdown.creator = creatorBoost;

    let tagAffinityScore = 0;

    if (Array.isArray(post.tags)) {
      post.tags.forEach((tag) => {
        const normalized = cleanTag(tag);

        tagAffinityScore +=
          (favoriteTags[normalized] || 0) * 40;
      });
    }

    const category = cleanTag(post.category);

    if (category) {
      tagAffinityScore +=
        (favoriteCategories[category] || 0) * 50;
    }

    const tagBoost = Math.min(
      400,
      tagAffinityScore
    );

    score += tagBoost;
    breakdown.tags = tagBoost;

    const followingBoost = following.has(creatorId)
      ? 800
      : 0;

    score += followingBoost;
    breakdown.following = followingBoost;

    let completionBoost = 0;

    if (completion >= 85) {
      completionBoost = 600;
    } else if (completion >= 70) {
      completionBoost = 400;
    } else if (completion >= 50) {
      completionBoost = 250;
    } else if (completion >= 30) {
      completionBoost = 100;
    } else if (completion >= 15) {
      completionBoost = 30;
    }

    score += completionBoost;
    breakdown.completion = completionBoost;

    const saveRate = saves / watchCount;
    let saveBoost = 0;

    if (saveRate >= 0.2) {
      saveBoost = 400;
    } else if (saveRate >= 0.12) {
      saveBoost = 250;
    } else if (saveRate >= 0.06) {
      saveBoost = 150;
    } else if (saveRate >= 0.02) {
      saveBoost = 60;
    }

    score += saveBoost;
    breakdown.saves = saveBoost;

    const commentRate =
      respects > 0 ? comments / respects : 0;

    let commentBoost = 0;

    if (commentRate >= 0.15) {
      commentBoost = 250;
    } else if (commentRate >= 0.08) {
      commentBoost = 150;
    } else if (commentRate >= 0.03) {
      commentBoost = 80;
    } else if (commentRate >= 0.01) {
      commentBoost = 30;
    }

    score += commentBoost;
    breakdown.comments = commentBoost;

    const shareRate =
      respects > 0 ? shares / respects : 0;

    let shareBoost = 0;

    if (shareRate >= 0.1) {
      shareBoost = 300;
    } else if (shareRate >= 0.05) {
      shareBoost = 180;
    } else if (shareRate >= 0.02) {
      shareBoost = 90;
    } else if (shareRate >= 0.005) {
      shareBoost = 40;
    }

    score += shareBoost;
    breakdown.shares = shareBoost;

    const createdAt = new Date(
      post.createdAt
    ).getTime();

    const ageHours = Number.isFinite(createdAt)
      ? Math.max(
          1,
          (now - createdAt) /
            (1000 * 60 * 60)
        )
      : 1;

    const recencyBoost = Math.max(
      0,
      300 - ageHours * 3
    );

    score += recencyBoost;
    breakdown.recency = recencyBoost;

    const respectsPerHour =
      respects / ageHours;

    let velocityBoost = 0;

    if (respectsPerHour > 1000) {
      velocityBoost = 350;
    } else if (respectsPerHour > 300) {
      velocityBoost = 200;
    } else if (respectsPerHour > 50) {
      velocityBoost = 100;
    } else if (respectsPerHour > 5) {
      velocityBoost = 30;
    }

    score += velocityBoost;
    breakdown.velocity = velocityBoost;

    if (ageHours > 72) {
      const agePenalty = Math.min(
        250,
        (ageHours - 72) * 4
      );

      score -= agePenalty;
      breakdown.agePenalty = -agePenalty;
    }

    let viralPenalty = 0;

    if (respects > 1000000) {
      viralPenalty = 400;
    } else if (respects > 500000) {
      viralPenalty = 250;
    } else if (respects > 100000) {
      viralPenalty = 100;
    }

    score -= viralPenalty;
    breakdown.viralPenalty = -viralPenalty;

    if (respects < 2000 && completion >= 75) {
      score += 450;
      breakdown.hiddenGem = 450;
    }

    if (watchedPostIds.has(toId(post.id))) {
      score -= 600;
      breakdown.watchedPenalty = -600;
    }

    return {
      ...post,
      score: Math.round(score),
      breakdown,
    };
  });

  scoredPosts.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return toId(a.id).localeCompare(
      toId(b.id)
    );
  });

  const finalFeed = [];
  const creatorCount = {};
  const selectedKeys = new Set();

  for (const post of scoredPosts) {
    const key = getContentKey(post);

    if (!key || selectedKeys.has(key)) {
      continue;
    }

    const creatorId =
      toId(post.creatorId) || "unknown";

    if ((creatorCount[creatorId] || 0) >= 2) {
      continue;
    }

    finalFeed.push(post);
    selectedKeys.add(key);
    creatorCount[creatorId] =
      (creatorCount[creatorId] || 0) + 1;
  }

  for (const post of scoredPosts) {
    if (finalFeed.length >= scoredPosts.length) {
      break;
    }

    const key = getContentKey(post);

    if (!key || selectedKeys.has(key)) {
      continue;
    }

    finalFeed.push(post);
    selectedKeys.add(key);
  }

  const hiddenGem = scoredPosts.find((post) => {
    const postRespects =
      Number(post.totalRespects) || 0;

    const postCompletion =
      normalizeCompletion(
        post.avgCompletionRate
      );

    return (
      postRespects < 500 &&
      postCompletion >= 60 &&
      !watchedPostIds.has(toId(post.id)) &&
      !finalFeed.some(
        (item) => toId(item.id) === toId(post.id)
      )
    );
  });

  if (hiddenGem && finalFeed.length >= 5) {
    finalFeed.splice(4, 0, {
      ...hiddenGem,
      isHiddenGem: true,
    });
  }

  const requestedLimit = Number(options.limit);

  if (
    Number.isInteger(requestedLimit) &&
    requestedLimit > 0
  ) {
    return finalFeed.slice(0, requestedLimit);
  }

  return finalFeed;
};