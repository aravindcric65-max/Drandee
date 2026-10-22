const fs = require('fs');
const path = require('path');

const engagementPath = path.join(__dirname, '../routes/engagement.js');
let code = fs.readFileSync(engagementPath, 'utf8');

// Replacements as authorized by the prompt:
code = code.replace(/comment_likes/g, 'comment_respects');
code = code.replace(/like_count/g, 'respect_count');
code = code.replace(/\/comments\/:id\/like/g, '/comments/:id/respect');
code = code.replace(/likes: /g, 'respects: ');
code = code.replace(/totalLikes/g, 'totalRespects');
code = code.replace(/AS likes/g, 'AS respects');
code = code.replace(/let liked;/g, 'let respected;');
code = code.replace(/liked = false;/g, 'respected = false;');
code = code.replace(/liked = true;/g, 'respected = true;');
code = code.replace(/liked,/g, 'respected,');
code = code.replace(/row\.likes/g, 'row.respects');
code = code.replace(/Comment like rollback error/g, 'Comment respect rollback error');
code = code.replace(/Comment like error/g, 'Comment respect error');
code = code.replace(/\/\*[\s\*]+POST \/api\/engagement\/comments\/:id\/like \- NEW!/g, '/*\n   * POST /api/engagement/comments/:id/respect - NEW!');

fs.writeFileSync(engagementPath, code);
console.log('Updated routes/engagement.js');

const velocityTrackerPath = path.join(__dirname, '../frontend/src/utils/velocityTracker.js');
let velocityCode = fs.readFileSync(velocityTrackerPath, 'utf8');

velocityCode = velocityCode.replace(/like: 1\.5,/g, 'respect: 1.5,');
velocityCode = velocityCode.replace(/'like'/g, "'respect'");

fs.writeFileSync(velocityTrackerPath, velocityCode);
console.log('Updated utils/velocityTracker.js');

const settingsPath = path.join(__dirname, '../frontend/src/pages/Settings.jsx');
let settingsCode = fs.readFileSync(settingsPath, 'utf8');
settingsCode = settingsCode.replace(/Respects \(Likes\)/g, 'Respects');
fs.writeFileSync(settingsPath, settingsCode);
console.log('Updated pages/Settings.jsx');
