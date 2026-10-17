// Drandee Badge & Rank System — Full 10-level system
export const LEVELS = [
  { level:1,  title:'Newcomer',     minRespects:0,       nextLevel:10000,     color:'#95A5A6', gradient:'linear-gradient(135deg,#95A5A6,#7f8c8d)', rarity:'Common',    percentage:'60%',   challenge:'Get 10k respects',        description:'Welcome to Drandee! Start creating.' },
  { level:2,  title:'Novice',       minRespects:10000,     nextLevel:50000,     color:'#4ECDC4', gradient:'linear-gradient(135deg,#4ECDC4,#26a69a)', rarity:'Common',    percentage:'40%',   challenge:'Reach 50k respects',      description:'Gaining traction with your posts.' },
  { level:3,  title:'Beginner',     minRespects:50000,     nextLevel:100000,    color:'#FF6B6B', gradient:'linear-gradient(135deg,#FF6B6B,#ee5a24)', rarity:'Uncommon',  percentage:'25%',   challenge:'Earn 100K respects',        description:'A recognized voice on Drandee.' },
  { level:4,  title:'Intermediate', minRespects:100000,    nextLevel:500000,    color:'#9370DB', gradient:'linear-gradient(135deg,#9370DB,#7c4dff)', rarity:'Uncommon',  percentage:'15%',   challenge:'Reach 500K respects',       description:'Consistent creator with strong community.' },
  { level:5,  title:'Advanced',     minRespects:500000,    nextLevel:1000000,   color:'#7B68EE', gradient:'linear-gradient(135deg,#7B68EE,#651fff)', rarity:'Rare',      percentage:'8%',    challenge:'Earn 1M respects',       description:'Influential creator on Drandee.' },
  { level:6,  title:'Pro',          minRespects:1000000,   nextLevel:5000000,   color:'#4A90E2', gradient:'linear-gradient(135deg,#4A90E2,#2196f3)', rarity:'Rare',      percentage:'5%',    challenge:'Reach 5M respects',      description:'Professional creator with official badge.' },
  { level:7,  title:'Expert',       minRespects:5000000,   nextLevel:10000000,  color:'#CD7F32', gradient:'linear-gradient(135deg,#CD7F32,#bf6c00)', rarity:'Epic',      percentage:'2%',    challenge:'Earn 10M respects',      description:'Expert creator with exceptional reach.' },
  { level:8,  title:'Master',       minRespects:10000000,  nextLevel:50000000,  color:'#C0C0C0', gradient:'linear-gradient(135deg,#C0C0C0,#9e9e9e)', rarity:'Epic',      percentage:'1%',    challenge:'Reach 50M respects',     description:'Master whose content sets trends.' },
  { level:9,  title:'Icon',         minRespects:50000000,  nextLevel:100000000, color:'#E5E4E2', gradient:'linear-gradient(135deg,#E5E4E2,#b0bec5)', rarity:'Legendary', percentage:'0.1%',  challenge:'Reach 100M respects',       description:'Iconic status with monumental influence.' },
  { level:10, title:'Legend',       minRespects:100000000, nextLevel:null,    color:'#FFD700', gradient:'linear-gradient(135deg,#FFD700,#ff8f00)', rarity:'Mythic',    percentage:'0.01%', challenge:'You are the Legend',      description:'The pinnacle of greatness on Drandee.' },
];

export const calculateRank = (totalRespects = 0) => {
  const respects = Math.max(0, Number(totalRespects) || 0);
  let match = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (respects >= LEVELS[i].minRespects) { match = LEVELS[i]; break; }
  }
  return {
    level: match.level,
    title: match.title,
    badge: match.level >= 6 ? match.title : null,
    badgeDisplay: match.title,
    color: match.color,
    gradient: match.gradient,
    description: match.description,
    rarity: match.rarity,
    percentage: match.percentage,
    nextLevel: match.nextLevel,
    challenge: match.challenge,
    minRespects: match.minRespects,
  };
};

export const getBadge = (respects) => calculateRank(respects).badge;

export const getRank = (totalRespects) => calculateRank(totalRespects);

export const getRankProgress = (currentRespects = 0, nextLevel = null) => {
  const r = Math.max(0, Number(currentRespects) || 0);
  const rank = calculateRank(r);
  const target = nextLevel != null ? Number(nextLevel) : rank.nextLevel;
  if (!target || r >= target) return 100;
  const min = rank.minRespects || 0;
  if (target <= min) return 100;
  return Math.min(100, Math.max(0, Math.round(((r - min) / (target - min)) * 100)));
};

export const getRespectsForNextLevel = (currentRespects = 0) => {
  const r = Math.max(0, Number(currentRespects) || 0);
  const rank = calculateRank(r);
  return { nextLevel: rank.nextLevel, respectsNeeded: rank.nextLevel != null ? Math.max(0, rank.nextLevel - r) : 0 };
};

export const checkLevelUp = (oldRespects = 0, newRespects = 0) => {
  const oldRank = calculateRank(oldRespects);
  const newRank = calculateRank(newRespects);
  return { leveledUp: newRank.level > oldRank.level, oldLevel: oldRank.level, newLevel: newRank.level, oldTitle: oldRank.title, newTitle: newRank.title };
};

export const formatRespects = (n) => {
  if (n == null || isNaN(n)) return '0';
  const num = Number(n);
  if (num <= 0) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
};

const badgeSystem = { LEVELS, calculateRank, getBadge, getRank, getRankProgress, getRespectsForNextLevel, checkLevelUp, formatRespects };
export default badgeSystem;
