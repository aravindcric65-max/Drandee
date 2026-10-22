/*Let me read the exact current content of both files before editing./**
 * Drandee Home Feed Ranking Engine
 * 
 * Implements FOR YOU, FOLLOWING, and LOCAL ranking algorithms, 
 * diversity engine, and fatigue prevention.
 */

const calculateInterestScore = (post, userInterests) => {
  if (!post.tags || !Array.isArray(post.tags) || !userInterests) return 0.5;
  let matchScore = 0;
  let totalWeight = 0;
  
  const interests = userInterests.interests || [];
  post.tags.forEach(tag => {
    const match = interests.find(i => i.topic === tag);
    if (match) {
      matchScore += match.score;
      totalWeight += 1;
    }
  });
  
  return totalWeight === 0 ? 0.1 : Math.min(1.0, matchScore / totalWeight);
};

const calculateSessionIntent = (post, userInterests) => {
  if (!post.tags || !Array.isArray(post.tags) || !userInterests) return 0.5;
  let matchScore = 0;
  let totalWeight = 0;
  
  const sessionInterests = userInterests.session_interests || [];
  post.tags.forEach(tag => {
    const match = sessionInterests.find(i => i.topic === tag);
    if (match) {
      matchScore += match.score;
      totalWeight += 1;
    }
  });
  
  return totalWeight === 0 ? 0 : Math.min(1.0, matchScore / totalWeight);
};

const calculateContentValue = (post) => {
  const views = post.watch_count || 1;
  const respects = post.total_respects || 0;
  const comments = post.comment_count || 0;
  const shares = post.share_count || 0;
  const saves = post.save_count || 0;
  
  let score = 0;
  if (post.type === 'video') {
    const completionRate = post.avg_completion_rate || 0;
    score = ((respects * 1) + (comments * 2) + (shares * 3) + (saves * 4)) / views;
    score = (score * 0.5) + (completionRate * 0.5);
  } else if (post.type === 'photo') {
    score = ((respects * 2) + (comments * 3) + (shares * 4) + (saves * 5)) / views;
  } else if (post.type === 'text' || post.type === 'discussion') {
    score = ((respects * 1) + (comments * 5) + (shares * 4) + (saves * 2)) / views;
  } else {
    score = ((respects * 1) + (comments * 2) + (shares * 3) + (saves * 4)) / views;
  }
  
  return Math.min(1.0, score * 10);
};

const calculateFreshness = (post) => {
  if (!post.created_at) return 0;
  const hoursOld = (new Date() - new Date(post.created_at)) / (1000 * 60 * 60);
  if (hoursOld <= 2) return 1.0;
  if (hoursOld <= 24) return Math.max(0.6, 1.0 - (hoursOld / 24) * 0.4);
  return Math.max(0.1, 0.6 * Math.exp(-(hoursOld - 24) / 72));
};

const calculateGeographicRelevance = (post, user) => {
  if (!user || !post.region || !user.city) return 0;
  try {
    const regionStr = String(post.region).toLowerCase();
    const cityStr = String(user.city).toLowerCase();
    if (regionStr === cityStr) return 1.0;
    if (user.state && regionStr === String(user.state).toLowerCase()) return 0.5;
    return 0.1;
  } catch(e) {
    return 0;
  }
};

const calculateSocialRelevance = (post, followsSet) => {
  if (!followsSet) return 0;
  return followsSet.has(post.user_id) ? 1.0 : 0;
};

const calculateLocalCommunitySignal = (post, user) => {
  // Mock community signal matching based on region + engagement
  return (calculateGeographicRelevance(post, user) * 0.5) + (calculateContentValue(post) * 0.5);
};

// Main Ranking Functions
const rankForYou = (post, userContext) => {
  const interest = calculateInterestScore(post, userContext.interests);
  const value = calculateContentValue(post);
  const intent = calculateSessionIntent(post, userContext.interests);
  const freshness = calculateFreshness(post);
  const diversityOp = 0.5; // Base, adjusted in assembler
  const exploration = Math.random() * 0.5; 
  
  const score = 
    (interest * 0.35) + 
    (value * 0.20) + 
    (intent * 0.15) + 
    (freshness * 0.10) + 
    (diversityOp * 0.10) + 
    (exploration * 0.10);
    
  return { ...post, finalScore: score };
};

const rankFollowing = (post, userContext) => {
  const social = calculateSocialRelevance(post, userContext.followsSet);
  const value = calculateContentValue(post);
  const freshness = calculateFreshness(post);
  
  const score = (social * 0.30) + (value * 0.40) + (freshness * 0.30);
  return { ...post, finalScore: score };
};

const rankLocal = (post, userContext) => {
  const geo = calculateGeographicRelevance(post, userContext.user);
  const value = calculateContentValue(post);
  const interest = calculateInterestScore(post, userContext.interests);
  const freshness = calculateFreshness(post);
  const social = calculateSocialRelevance(post, userContext.followsSet);
  const community = calculateLocalCommunitySignal(post, userContext.user);
  
  const score = 
    (geo * 0.30) +
    (value * 0.20) +
    (interest * 0.15) +
    (freshness * 0.15) +
    (social * 0.10) +
    (community * 0.10);
    
  return { ...post, finalScore: score };
};

const applyDiversityEngine = (rankedPosts, limit) => {
  const finalFeed = [];
  const seenCreators = new Set();
  const seenFormats = new Set();
  
  // Create a copy of sorted posts
  let available = [...rankedPosts].sort((a, b) => b.finalScore - a.finalScore);
  
  while (finalFeed.length < limit && available.length > 0) {
    let selectedIndex = 0;
    
    // Scan top 5 for the best diversity candidate
    for (let i = 0; i < Math.min(5, available.length); i++) {
      const candidate = available[i];
      let penalty = 0;
      
      if (seenCreators.has(candidate.user_id)) penalty += 0.4;
      if (seenFormats.has(candidate.type)) penalty += 0.2;
      
      const effectiveScore = candidate.finalScore - penalty;
      
      if (effectiveScore > available[selectedIndex].finalScore - (seenCreators.has(available[selectedIndex].user_id) ? 0.4 : 0) - (seenFormats.has(available[selectedIndex].type) ? 0.2 : 0)) {
        selectedIndex = i;
      }
    }
    
    const selected = available.splice(selectedIndex, 1)[0];
    finalFeed.push(selected);
    seenCreators.add(selected.user_id);
    seenFormats.add(selected.type);
    
    // Prune sets occasionally to allow rhythm loop (e.g. video -> text -> photo -> video)
    if (finalFeed.length % 3 === 0) {
      seenFormats.clear(); 
    }
    if (finalFeed.length % 5 === 0) {
      seenCreators.clear();
    }
  }
  
  return finalFeed;
};

module.exports = {
  rankForYou,
  rankFollowing,
  rankLocal,
  applyDiversityEngine
};
