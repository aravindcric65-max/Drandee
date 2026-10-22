const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../backend/frontend/src');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

try {
  // 1. Check Light Mode colors in FeedCreatorHeader
  const headerContent = fs.readFileSync(path.join(srcDir, 'components/home/FeedCreatorHeader.jsx'), 'utf-8');
  assert(headerContent.includes('text-[#111111]') || headerContent.includes('text-[#111]'), 'Light mode text color exists in FeedCreatorHeader');
  assert(headerContent.includes('bg-transparent text-[#666666]') || headerContent.includes('hover:bg-black/5'), 'Follow button handles light mode colors correctly');
  
  // 2. FeedCreatorHeader contains Follow/Following logic
  assert(headerContent.includes('isFollowingPending ? \'...\' : isFollowing ? \'Following\' : \'Follow\''), 'Follow toggle logic exists in header');
  
  // 3. Current-user protection
  assert(headerContent.includes('!isOwnPost &&'), 'isOwnPost check protects follow toggle');
  
  // 4. Loading protection
  assert(headerContent.includes('disabled={isFollowingPending}'), 'Follow toggle disabled while pending');
  
  // 5. Existing API reused
  assert(headerContent.includes('handleToggleFollow'), 'Uses existing toggle follow handler (reused API)');
  
  // 6. Check Discover
  const discoverContent = fs.readFileSync(path.join(srcDir, 'pages/Discover.jsx'), 'utf-8');
  assert(!discoverContent.includes('bg-[#050505]'), 'Discover bg color converted to light mode');
  assert(discoverContent.includes('bg-white') && discoverContent.includes('text-[#111111]'), 'Discover uses light mode styles');

  // 7. Check ViewersModal
  const viewersModalContent = fs.readFileSync(path.join(srcDir, 'components/home/ViewersModal.jsx'), 'utf-8');
  assert(viewersModalContent.includes('bg-[#F7F7F9]') && viewersModalContent.includes('text-[#111111]'), 'ViewersModal converted to light mode');

  // 8. Check Protected Files
  const feedRanker = fs.readFileSync(path.join(__dirname, '../backend/utils/feedRanker.js'), 'utf-8');
  assert(feedRanker.length > 0, 'feedRanker.js is accessible (will check git status for modifications separately)');
  
  // 9. Fake API checks
  assert(!headerContent.includes('setTimeout(() => setIsFollowing'), 'No fake setTimeout-based follow implementation');

  console.log('\n✅ All Phase 9.1 tests passed successfully!');
} catch (err) {
  console.error('❌ Test script failed:', err.message);
  process.exit(1);
}
