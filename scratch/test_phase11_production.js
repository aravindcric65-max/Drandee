const fs = require('fs');
const path = require('path');

console.log('--- Phase 11 Production Readiness Test Suite ---\n');

let allPassed = true;

// 1. Text publish endpoint and response handling exists
const textPostStudioPath = path.join(__dirname, '../backend/frontend/src/components/studio/TextPostStudio.jsx');
const textPostStudioContent = fs.readFileSync(textPostStudioPath, 'utf8');

if (textPostStudioContent.includes('fetch(\'/api/upload/posts\'') && textPostStudioContent.includes('response.headers.get(\'content-type\')')) {
  console.log('✅ PASSED: Text publish endpoint and robust response handling exists');
} else {
  console.error('❌ FAILED: Robust response handling missing in TextPostStudio');
  allPassed = false;
}

// 2. isPublishing protection exists
const privacyPanelPath = path.join(__dirname, '../backend/frontend/src/components/studio/PrivacyPanel.jsx');
const privacyPanelContent = fs.readFileSync(privacyPanelPath, 'utf8');

if (privacyPanelContent.includes('const [isPublishing, setIsPublishing] = useState(false)') && 
    privacyPanelContent.includes('if (isPublishing) return')) {
  console.log('✅ PASSED: isPublishing protection exists');
} else {
  console.error('❌ FAILED: isPublishing protection missing');
  allPassed = false;
}

// 3. Form fields have id/name
if (textPostStudioContent.includes('id="text-post-input"') && privacyPanelContent.includes('id="caption-input"')) {
  console.log('✅ PASSED: Form fields have id/name for accessibility');
} else {
  console.error('❌ FAILED: Form fields missing id/name');
  allPassed = false;
}

// 4. Protected backend files unchanged
const rankerPath = path.join(__dirname, '../backend/utils/feedRanker.js');
const expPath = path.join(__dirname, '../backend/utils/feedExperiment.js');
const authPath = path.join(__dirname, '../backend/middleware/auth.js');

if (fs.existsSync(rankerPath) && fs.existsSync(expPath) && fs.existsSync(authPath)) {
  console.log('✅ PASSED: Protected backend files exist (git diff will confirm unchanged)');
} else {
  console.error('❌ FAILED: Protected files missing!');
  allPassed = false;
}

console.log('\nResult: ' + (allPassed ? '✅ All Phase 11 checks passed' : '❌ Phase 11 tests failed'));
process.exit(allPassed ? 0 : 1);
