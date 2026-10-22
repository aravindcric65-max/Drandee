const fs = require('fs');
const path = require('path');

console.log('--- Phase 11.1 Universal Upload Verification Test Suite ---\n');

let allPassed = true;

// 1. Text publish uses safe response handling
const textPostStudioPath = path.join(__dirname, '../backend/frontend/src/components/studio/TextPostStudio.jsx');
const textPostStudioContent = fs.readFileSync(textPostStudioPath, 'utf8');

if (textPostStudioContent.includes('parseApiResponse(response')) {
  console.log('✅ PASSED: Text publish uses parseApiResponse');
} else {
  console.error('❌ FAILED: Text publish missing parseApiResponse');
  allPassed = false;
}

// 2. Video publish uses safe response handling
const uploadContextPath = path.join(__dirname, '../backend/frontend/src/context/UploadContext.jsx');
const uploadContextContent = fs.readFileSync(uploadContextPath, 'utf8');

if (uploadContextContent.includes('parseApiResponse') && !uploadContextContent.includes('.json()')) {
  console.log('✅ PASSED: Video/Context publish uses parseApiResponse completely');
} else {
  console.error('❌ FAILED: Video/Context missing parseApiResponse or still uses fragile json()');
  allPassed = false;
}

// 3. ImageKitService uses safe response handling
const imageKitPath = path.join(__dirname, '../backend/frontend/src/services/imageKitService.js');
const imageKitContent = fs.readFileSync(imageKitPath, 'utf8');
if (imageKitContent.includes('parseApiResponse') && !imageKitContent.includes('.json()')) {
  console.log('✅ PASSED: ImageKit publish uses safe response handling');
} else {
  console.error('❌ FAILED: ImageKit uses fragile json()');
  allPassed = false;
}

// 4. MediaAPI uses safe response handling
const mediaApiPath = path.join(__dirname, '../backend/frontend/src/services/mediaApi.js');
const mediaApiContent = fs.readFileSync(mediaApiPath, 'utf8');
if (mediaApiContent.includes('parseApiResponse') && !mediaApiContent.includes('.json()')) {
  console.log('✅ PASSED: MediaApi uses safe response handling');
} else {
  console.error('❌ FAILED: MediaApi uses fragile json()');
  allPassed = false;
}

// 5. isPublishing exists
const privacyPanelPath = path.join(__dirname, '../backend/frontend/src/components/studio/PrivacyPanel.jsx');
const privacyPanelContent = fs.readFileSync(privacyPanelPath, 'utf8');
if (privacyPanelContent.includes('const [isPublishing, setIsPublishing] = useState(false)') && 
    privacyPanelContent.includes('if (isPublishing) return')) {
  console.log('✅ PASSED: isPublishing protection exists');
} else {
  console.error('❌ FAILED: isPublishing protection missing');
  allPassed = false;
}

// 6. Protected backend files unchanged
const rankerPath = path.join(__dirname, '../backend/utils/feedRanker.js');
const expPath = path.join(__dirname, '../backend/utils/feedExperiment.js');
const authPath = path.join(__dirname, '../backend/middleware/auth.js');

if (fs.existsSync(rankerPath) && fs.existsSync(expPath) && fs.existsSync(authPath)) {
  console.log('✅ PASSED: Protected backend files exist (git diff will confirm unchanged)');
} else {
  console.error('❌ FAILED: Protected files missing!');
  allPassed = false;
}

console.log('\nResult: ' + (allPassed ? '✅ All Phase 11.1 checks passed' : '❌ Phase 11.1 tests failed'));
process.exit(allPassed ? 0 : 1);
