/**
 * Spotlight System - Namma USP
 * 
 * Philosophy:
 * - Regular users: Easy to get spotlight (encourage participation)
 * - Creators: Hard to earn (quality over quantity)
 * - Fair distribution: Same creator spam avoid
 * - Quality-focused: Not just viral, but meaningful content
 */

// Calculate spotlight score based on post metrics
export const calculateScore = (post, userRole = 'user') => {
  if (!post) return 0;

  const now = new Date();
  const created = new Date(post.createdAt);
  const hoursSincePost = Math.max(0, (now - created) / (1000 * 60 * 60));

  // Base score from respects
  const respectScore = (post.totalRespects || 0) * 2;

  // Recency boost - 48 hours-ku max boost
  const recencyBoost = Math.max(0, 100 - hoursSincePost * 2);

  // Growth boost - tiered based on respects
  let growthBoost = 0;
  const respects = post.totalRespects || 0;
  if (respects >= 10000) growthBoost = 200;
  else if (respects >= 1000) growthBoost = 100;
  else if (respects >= 100) growthBoost = 50;
  else growthBoost = 10;

  // Velocity boost - recent-ah irundha extra push
  const velocityBoost = hoursSincePost < 6 ? 150 : hoursSincePost < 24 ? 75 : 0;

  // Role-based difficulty
  // Regular users: Lower threshold (encourage participation)
  // Creators: Higher threshold (must earn it)
  const roleMultiplier = userRole === 'creator' ? 0.7 : 1.2;

  // Quality score - engagement rate (respects per view)
  const qualityScore = post.watchCount > 0
    ? (respects / post.watchCount) * 100
    : 0;

  // Consistency bonus - creator-ah irundha regular posts podanum
  const consistencyBonus = post.creatorPostCount > 10
    ? Math.min(post.creatorPostCount / 10, 50)
    : 0;

  // Final score calculation
  const baseScore = respectScore + recencyBoost + growthBoost + velocityBoost;
  const finalScore = baseScore * roleMultiplier + qualityScore + consistencyBonus;

  return Math.round(finalScore);
};

// Region filter - post-la region field irundha filter pannum
const filterByRegion = (posts, region) => {
  if (!region) return posts;

  const regionPosts = posts.filter(
    (p) => p.region?.toLowerCase() === region.toLowerCase()
  );

  // Region posts illanna fallback - all posts
  return regionPosts.length >= 3 ? regionPosts : posts;
};

// Diversity control - same creator spam avoid
const diversify = (posts, maxPerCreator = 2) => {
  const final = [];
  const creatorCount = {};

  for (let post of posts) {
    const creatorId = post.creatorId || post.userId;
    const count = creatorCount[creatorId] || 0;

    if (count < maxPerCreator) {
      final.push(post);
      creatorCount[creatorId] = count + 1;
    }
  }

  return final;
};

// Generate spotlight posts for different tiers
export const generateSpotlight = (posts, userRole = 'user') => {
  if (!posts || posts.length === 0) {
    return { local: [], state: [], national: [], global: [], rising: [] };
  }

  // Calculate scores for all posts
  const scored = posts.map((p) => ({
    ...p,
    score: calculateScore(p, userRole),
  }));

  // Sort by score (highest first)
  const sorted = scored.sort((a, b) => b.score - a.score);

  // Local - region filter + diversity
  const localRaw = filterByRegion(sorted, 'local');
  const local = diversify(localRaw, 2).slice(0, 10);

  // State - state filter + diversity
  const stateRaw = filterByRegion(sorted, 'state');
  const state = diversify(stateRaw, 2).slice(0, 10);

  // National - top posts, max 1 per creator
  const national = diversify(sorted, 1).slice(0, 15);

  // Global - absolute best, strict 1 per creator
  const global = diversify(sorted, 1).slice(0, 5);

  // Rising - emerging creators (not verified, but high velocity)
  const rising = sorted
    .filter((p) => !p.isVerified && p.totalRespects < 1000)
    .slice(0, 10);

  return { local, state, national, global, rising };
};

// Spotlight label - hype without emoji
export const getSpotlightLabel = (score) => {
  if (score >= 5000) return 'On Fire';
  if (score >= 2000) return 'Trending';
  if (score >= 500) return 'Rising';
  return 'New';
};

// Spotlight badge color - based on tier
export const getSpotlightColor = (tier) => {
  switch (tier) {
    case 'global':
      return '#FFD700'; // Gold
    case 'national':
      return '#C0C0C0'; // Silver
    case 'state':
      return '#CD7F32'; // Bronze
    case 'local':
      return '#4A90E2'; // Blue
    case 'rising':
      return '#7B68EE'; // Purple
    default:
      return '#808080'; // Gray
  }
};

// Check if post qualifies for spotlight
export const qualifiesForSpotlight = (post, userRole = 'user') => {
  if (!post) return false;

  const score = calculateScore(post, userRole);
  const respects = post.totalRespects || 0;
  const hoursSincePost = Math.max(
    0,
    (new Date() - new Date(post.createdAt)) / (1000 * 60 * 60)
  );

  // Minimum requirements
  const minRespects = userRole === 'creator' ? 50 : 10;
  const maxAge = 168; // 7 days in hours

  return respects >= minRespects && hoursSincePost <= maxAge && score >= 100;
};

// Get spotlight requirements for user education
export const getSpotlightRequirements = (userRole = 'user') => {
  return {
    user: {
      minRespects: 10,
      maxAge: '7 days',
      description: 'Get 10+ respects on your post within 7 days to enter spotlight',
    },
    creator: {
      minRespects: 50,
      maxAge: '7 days',
      description: 'Get 50+ respects on your post within 7 days to enter spotlight',
    },
  };
};

// Calculate time remaining for spotlight eligibility
export const getTimeRemainingForSpotlight = (post, userRole = 'user') => {
  if (!post) return null;

  const now = new Date();
  const created = new Date(post.createdAt);
  const hoursSincePost = (now - created) / (1000 * 60 * 60);
  const maxAge = 168; // 7 days

  const hoursRemaining = Math.max(0, maxAge - hoursSincePost);

  if (hoursRemaining <= 0) {
    return { eligible: false, message: 'Post is too old for spotlight' };
  }

  const respects = post.totalRespects || 0;
  const minRespects = userRole === 'creator' ? 50 : 10;

  if (respects >= minRespects) {
    return {
      eligible: true,
      message: `Post is eligible for spotlight!`,
      hoursRemaining: Math.round(hoursRemaining),
    };
  }

  const respectsNeeded = minRespects - respects;

  return {
    eligible: false,
    message: `${respectsNeeded} more respects needed in ${Math.round(hoursRemaining)} hours`,
    respectsNeeded,
    hoursRemaining: Math.round(hoursRemaining),
  };
};

const spotlightSystem = {
  calculateScore,
  generateSpotlight,
  getSpotlightLabel,
  getSpotlightColor,
  qualifiesForSpotlight,
  getSpotlightRequirements,
  getTimeRemainingForSpotlight,
};

export default spotlightSystem;