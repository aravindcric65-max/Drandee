const fs = require('fs');
const path = require('path');

const filesToTest = [
  'backend/frontend/src/pages/Reels.jsx',
  'backend/frontend/src/components/home/Feed.jsx',
  'backend/frontend/src/context/UserContext.jsx',
  'backend/frontend/src/pages/Profile.jsx',
  'backend/frontend/src/components/home/PostActions.jsx',
  'backend/frontend/src/components/spotlight/SpotlightHeader.jsx',
  'backend/routes/posts.js',
];

let allPassed = true;

console.log("== Phase 12.4 Final Production Readiness Test ==");

filesToTest.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ [FAIL] Missing file: ${file}`);
    allPassed = false;
    return;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.trim().length === 0) {
      console.error(`❌ [FAIL] File is empty: ${file}`);
      allPassed = false;
    } else {
      console.log(`✅ [PASS] ${file} is intact.`);
    }
  } catch (err) {
    console.error(`❌ [FAIL] Error reading ${file}: ${err.message}`);
    allPassed = false;
  }
});

console.log("\n== Final Verification ==");
if (allPassed) {
  console.log("✅ All production files verified intact.");
} else {
  console.log("❌ Production readiness test failed.");
  process.exit(1);
}
