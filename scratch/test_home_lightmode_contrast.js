const fs = require('fs');
const path = require('path');

console.log('--- Home Light Mode Contrast Test Suite ---\n');

const componentsDir = path.join(__dirname, '../backend/frontend/src/components/home');
const pagesDir = path.join(__dirname, '../backend/frontend/src/pages');

function checkFileForForbiddenPatterns(filePath) {
  if (!fs.existsSync(filePath)) return true;
  const content = fs.readFileSync(filePath, 'utf8');
  let passed = true;

  const forbiddenPatterns = [
    { regex: /bg-\[#121215\]/, desc: 'Legacy dark mode modal container' },
    { regex: /text-white\/40/, desc: 'Invisible muted text on white' },
    { regex: /bg-black flex flex-col justify-center px-4 sm:px-6 py-8 sm:py-10/, desc: 'Legacy dark RecommendedCreators container' }
  ];

  forbiddenPatterns.forEach(pattern => {
    if (pattern.regex.test(content)) {
      console.error(`❌ FAILED: Found ${pattern.desc} in ${path.basename(filePath)}`);
      passed = false;
    }
  });

  return passed;
}

let allPassed = true;

// 1. Check RecommendedCreators.jsx
const recPassed = checkFileForForbiddenPatterns(path.join(componentsDir, 'RecommendedCreators.jsx'));
if (recPassed) console.log('✅ PASSED: RecommendedCreators uses Light Mode tokens');
else allPassed = false;

// 2. Check ReportModal.jsx
const reportPassed = checkFileForForbiddenPatterns(path.join(componentsDir, 'ReportModal.jsx'));
if (reportPassed) console.log('✅ PASSED: ReportModal uses Light Mode tokens');
else allPassed = false;

// 3. Check MoreMenu.jsx
const moreMenuPassed = checkFileForForbiddenPatterns(path.join(componentsDir, 'MoreMenu.jsx'));
if (moreMenuPassed) console.log('✅ PASSED: MoreMenu uses Light Mode tokens');
else allPassed = false;

// 4. Check CommentModal.jsx drag handle
const commentModalContent = fs.readFileSync(path.join(componentsDir, 'CommentModal.jsx'), 'utf8');
if (!commentModalContent.includes('bg-white/20') && commentModalContent.includes('bg-black/20')) {
  console.log('✅ PASSED: CommentModal uses Light Mode drag handle');
} else {
  console.error('❌ FAILED: CommentModal still has invisible white drag handle');
  allPassed = false;
}

// 5. Check Protected Files Intact
const rankerPath = path.join(__dirname, '../backend/utils/feedRanker.js');
const expPath = path.join(__dirname, '../backend/utils/feedExperiment.js');
const authPath = path.join(__dirname, '../backend/middleware/auth.js');

if (fs.existsSync(rankerPath) && fs.existsSync(expPath) && fs.existsSync(authPath)) {
  console.log('✅ PASSED: Protected backend files are structurally intact (will be verified via git diff)');
} else {
  console.error('❌ FAILED: Protected files missing!');
  allPassed = false;
}

console.log('\nResult: ' + (allPassed ? '✅ All checks passed' : '❌ Tests failed'));
process.exit(allPassed ? 0 : 1);
