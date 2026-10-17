/**
 * Rank System - User progression based on respects
 */

// Calculate user rank based on total respects
export const calculateRank = (totalRespects) => {
  const respects = totalRespects || 0;

  if (respects >= 1000000) {
    return {
      level: 10,
      title: 'Legend',
      badge: 'legend',
      color: '#FFD700',
      nextLevel: null,
    };
  } else if (respects >= 500000) {
    return {
      level: 9,
      title: 'Icon',
      badge: 'icon',
      color: '#E5E4E2',
      nextLevel: 1000000,
    };
  } else if (respects >= 100000) {
    return {
      level: 8,
      title: 'Master',
      badge: 'master',
      color: '#C0C0C0',
      nextLevel: 500000,
    };
  } else if (respects >= 50000) {
    return {
      level: 7,
      title: 'Expert',
      badge: 'expert',
      color: '#CD7F32',
      nextLevel: 100000,
    };
  } else if (respects >= 10000) {
    return {
      level: 6,
      title: 'Pro',
      badge: 'pro',
      color: '#4A90E2',
      nextLevel: 50000,
    };
  } else if (respects >= 5000) {
    return {
      level: 5,
      title: 'Advanced',
      badge: 'advanced',
      color: '#7B68EE',
      nextLevel: 10000,
    };
  } else if (respects >= 1000) {
    return {
      level: 4,
      title: 'Intermediate',
      badge: 'intermediate',
      color: '#9370DB',
      nextLevel: 5000,
    };
  } else if (respects >= 500) {
    return {
      level: 3,
      title: 'Beginner',
      badge: 'beginner',
      color: '#FF6B6B',
      nextLevel: 1000,
    };
  } else if (respects >= 100) {
    return {
      level: 2,
      title: 'Novice',
      badge: 'novice',
      color: '#4ECDC4',
      nextLevel: 500,
    };
  } else {
    return {
      level: 1,
      title: 'Newcomer',
      badge: 'newcomer',
      color: '#95A5A6',
      nextLevel: 100,
    };
  }
};

// Get rank based on total respects (alias for calculateRank)
export const getRank = (totalRespects) => {
  return calculateRank(totalRespects);
};

// Get rank progress percentage
export const getRankProgress = (currentRespects, nextLevel) => {
  if (!nextLevel) return 100;

  const prevLevel = getNextLevelBelow(nextLevel);
  const progress = ((currentRespects - prevLevel) / (nextLevel - prevLevel)) * 100;
  return Math.min(100, Math.max(0, progress));
};

// Get next level below current
const getNextLevelBelow = (level) => {
  const levels = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  const index = levels.indexOf(level);
  return index > 0 ? levels[index - 1] : 0;
};

// Calculate respects needed for next level
export const getRespectsForNextLevel = (currentRespects) => {
  const levels = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];

  for (const level of levels) {
    if (currentRespects < level) {
      return {
        nextLevel: level,
        respectsNeeded: level - currentRespects,
      };
    }
  }

  return {
    nextLevel: null,
    respectsNeeded: 0,
  };
};

// Get rank badge URL
export const getRankBadgeUrl = (badge) => {
  return `/badges/${badge}.png`;
};

// Get rank color for UI
export const getRankColor = (level) => {
  const rank = calculateRank(level);
  return rank.color;
};

// Check if user leveled up
export const checkLevelUp = (oldRespects, newRespects) => {
  const oldRank = calculateRank(oldRespects);
  const newRank = calculateRank(newRespects);

  return {
    leveledUp: newRank.level > oldRank.level,
    oldLevel: oldRank.level,
    newLevel: newRank.level,
    oldTitle: oldRank.title,
    newTitle: newRank.title,
  };
};

const rankSystem = {
  calculateRank,
  getRank,
  getRankProgress,
  getRespectsForNextLevel,
  getRankBadgeUrl,
  getRankColor,
  checkLevelUp,
};

export default rankSystem;