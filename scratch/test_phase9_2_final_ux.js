const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '../backend/frontend/src');

function readFile(relativePath) {
  try {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  } catch (e) {
    return null;
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function runTests() {
  console.log('--- Phase 9.2 Final UX/UI Polish Test Suite ---\n');

  // 1. App Transition
  const appJsx = readFile('App.jsx');
  assert(appJsx && appJsx.includes('scale: 0.94') && appJsx.includes('opacity: 0') && appJsx.includes('prefers-reduced-motion'), 'App.jsx contains cinematic intro transition and prefers-reduced-motion check');

  // 2. UploadStudio isPublishing Lock
  const uploadStudio = readFile('pages/UploadStudio.jsx');
  assert(uploadStudio && uploadStudio.includes('const [isPublishing, setIsPublishing] = useState(false)') && uploadStudio.includes('if (isPublishing) return;'), 'UploadStudio has isPublishing state lock');
  assert(uploadStudio && !uploadStudio.includes('color="#fff"') && uploadStudio.includes('color="#111111"'), 'UploadStudio has Light Mode close icon color');

  // 3. Notifications Metric border
  const notifications = readFile('pages/Notifications.jsx');
  assert(notifications && notifications.includes('borderRight: i < 3 ? "0.5px solid #E8E8EC" : "none"'), 'Notifications metric bar uses Light Mode border #E8E8EC');

  // 4. CommentModal Input
  const commentModal = readFile('components/home/CommentModal.jsx');
  assert(commentModal && commentModal.includes('bg-[#F7F7F9]'), 'CommentModal uses Light Mode surface background');
  assert(commentModal && !commentModal.includes('hover:text-white'), 'CommentModal does not use white text hover');

  // 5. Home.jsx Toast Text
  const home = readFile('pages/Home.jsx');
  assert(home && home.includes('setToast("Link copied")'), 'Home.jsx toast text is standard "Link copied"');

  // 6. PostActions Tactile Feedback & Light Mode Border
  const postActions = readFile('components/home/PostActions.jsx');
  assert(postActions && postActions.includes('whileTap={{ scale: 0.95 }}'), 'PostActions includes Framer Motion whileTap scale 0.95');
  assert(postActions && postActions.includes('border-[#E8E8EC]'), 'PostActions uses Light Mode border');
  assert(postActions && postActions.includes('py-2 px-2.5'), 'PostActions maintains 44px effective touch target size');

  // 7. Profile QR Code
  const profile = readFile('pages/Profile.jsx');
  assert(profile && profile.includes('QRCodeSVG') && profile.includes('level="H"') && profile.includes('drandee.app/creator'), 'Profile.jsx has high-res QRCodeSVG implementation with canonical URL');

  // 8. AppRoutes fallback
  const appRoutes = readFile('routes/AppRoutes.jsx');
  assert(appRoutes && appRoutes.includes('<Route path="*" element={<Navigate to="/feed" replace />} />'), 'AppRoutes wildcard route points to /feed');

  // 9. Event Listener Cleanup
  const navbar = readFile('components/Navbar.jsx');
  assert(navbar && navbar.includes('removeEventListener(\'open-upload-studio\''), 'Navbar removes open-upload-studio listener');

  const pushNotif = readFile('components/notifications/PushNotification.jsx');
  assert(pushNotif && pushNotif.includes('removeEventListener(\'new_notification\''), 'PushNotification removes new_notification listener');

  console.log('\nAll checks completed.');
}

runTests();
