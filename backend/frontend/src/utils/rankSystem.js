/**
 * Rank System — delegates to badgeSystem (canonical 10-level creator ranks)
 */
import {
  LEVELS,
  calculateRank,
  getRank,
  getRankProgress,
  getRespectsForNextLevel,
  checkLevelUp,
  formatRespects,
  getBadge,
} from './badgeSystem';

export {
  LEVELS,
  calculateRank,
  getRank,
  getRankProgress,
  getRespectsForNextLevel,
  checkLevelUp,
  formatRespects,
  getBadge,
};

export const getRankBadgeUrl = (badge) => {
  const name = typeof badge === 'string'
    ? badge.toLowerCase()
    : (badge?.title || badge?.badge || 'newcomer').toLowerCase();
  return `/badges/${name}.png`;
};

export const getRankColor = (totalRespects) => {
  return calculateRank(totalRespects).color;
};

const rankSystem = {
  LEVELS,
  calculateRank,
  getRank,
  getRankProgress,
  getRespectsForNextLevel,
  getRankBadgeUrl,
  getRankColor,
  checkLevelUp,
  formatRespects,
  getBadge,
};

export default rankSystem;
