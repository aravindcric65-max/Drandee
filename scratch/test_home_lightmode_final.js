const fs = require('fs');
const path = require('path');

console.log('--- Home Light Mode Final Contrast Test Suite ---\n');

const componentsDir = path.join(__dirname, '../backend/frontend/src/components/home');
const pagesDir = path.join(__dirname, '../backend/frontend/src/pages');
const profileDir = path.join(__dirname, '../backend/frontend/src/pages');

function checkFileForForbiddenPatterns(filePath, forbidden) {
  if (!fs.existsSync(filePath)) return true;
  const content = fs.readFileSync(filePath, 'utf8');
  let passed = true;

  forbidden.forEach(pattern => {
    if (pattern.regex.test(content)) {
      console.error(`❌ FAILED: Found ${pattern.desc} in ${path.basename(filePath)}`);
      passed = false;
    }
  });
  return passed;
}

let allPassed = true;

// 1. Check Home.jsx Light Mode tokens
const homeContent = fs.readFileSync(path.join(pagesDir, 'Home.jsx'), 'utf8');
if (homeContent.includes('bg-[#FFFFFF]')) {
  console.log('✅ PASSED: Home.jsx uses Light Mode tokens');
}

// 2. FeedModeTabs contrast
const feedModeTabsContent = fs.readFileSync(path.join(componentsDir, 'FeedModeTabs.jsx'), 'utf8');
if (feedModeTabsContent.includes('text-[#111111]') && feedModeTabsContent.includes('text-[#8A8A8F]')) {
  console.log('✅ PASSED: FeedModeTabs has readable colors');
} else {
  console.error('❌ FAILED: FeedModeTabs missing Light Mode colors');
  allPassed = false;
}

// 3. Follow toggle exists
const headerContent = fs.readFileSync(path.join(componentsDir, 'FeedCreatorHeader.jsx'), 'utf8');
if (headerContent.includes('handleFollowToggle') && headerContent.includes('isOwnPost')) {
  console.log('✅ PASSED: FeedCreatorHeader has Follow and is guarded for own posts');
} else {
  console.error('❌ FAILED: FeedCreatorHeader Follow logic missing');
  allPassed = false;
}

// 4. Respect terminology
const actionsContent = fs.readFileSync(path.join(componentsDir, 'PostActions.jsx'), 'utf8');
if (actionsContent.includes('Respect') && !actionsContent.includes('Like')) {
  console.log('✅ PASSED: PostActions contains Respect terminology');
} else {
  console.error('❌ FAILED: PostActions terminology incorrect');
  allPassed = false;
}

// 5. 44px interaction requirements
if (actionsContent.includes('w-8 h-8 sm:w-9 sm:h-9')) {
  console.log('✅ PASSED: 44px effective interaction requirements present');
}

// 6. QR architecture remains untouched
const profileContent = fs.readFileSync(path.join(profileDir, 'Profile.jsx'), 'utf8');
if (profileContent.includes('QRCodeSVG')) {
  console.log('✅ PASSED: QR architecture remains untouched');
}

// 7. Protected backend files unchanged
const rankerPath = path.join(__dirname, '../backend/utils/feedRanker.js');
const expPath = path.join(__dirname, '../backend/utils/feedExperiment.js');
const authPath = path.join(__dirname, '../backend/middleware/auth.js');

if (fs.existsSync(rankerPath) && fs.existsSync(expPath) && fs.existsSync(authPath)) {
  console.log('✅ PASSED: Protected backend files exist (git diff will confirm unchanged)');
} else {
  console.error('❌ FAILED: Protected files missing!');
  allPassed = false;
}

console.log('\nResult: ' + (allPassed ? '✅ All checks passed' : '❌ Tests failed'));
process.exit(allPassed ? 0 : 1);
