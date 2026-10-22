/**
 * FINAL FIX: Remove all mock data from Profile.jsx
 */

const fs = require('fs');
const path = require('path');

const profilePath = path.join(__dirname, '../frontend/src/pages/Profile.jsx');

console.log('Applying final fix to remove all mock data from Profile.jsx...\n');

try {
  let content = fs.readFileSync(profilePath, 'utf8');
  
  // 1. Remove the entire mockFollowers usage in the followers sheet
  const followersSection = content.indexOf('Followers · {displayUser?.followerCount || 0}</span>');
  if (followersSection !== -1) {
    // Find the mockFollowers.map section
    const mapStart = content.indexOf('{mockFollowers.map', followersSection);
    if (mapStart !== -1) {
      // Find the end of this map function
      let braceCount = 1;
      let current = mapStart + 1;
      while (braceCount > 0 && current < content.length) {
        if (content[current] === '{') braceCount++;
        if (content[current] === '}') braceCount--;
        current++;
      }
      
      // Replace with empty state
      const before = content.substring(0, mapStart);
      const after = content.substring(current);
      const replacement = `{/* Followers list would load from API */}\n            <div style={{ padding: '40px 20px', textAlign: 'center' }}>\n              <span style={{ color: '#888', fontSize: 13 }}>Followers list would load from API</span>\n            </div>`;
      
      content = before + replacement + after;
      console.log('✓ Removed mock followers map');
    }
  }
  
  // 2. Remove the entire mockFollowers usage in the following sheet
  const followingSection = content.indexOf('Following · {displayUser?.followerCount || 0 - 2}</span>');
  if (followingSection !== -1) {
    const mapStart = content.indexOf('{mockFollowers.slice', followingSection);
    if (mapStart !== -1) {
      let braceCount = 1;
      let current = mapStart + 1;
      while (braceCount > 0 && current < content.length) {
        if (content[current] === '{') braceCount++;
        if (content[current] === '}') braceCount--;
        current++;
      }
      
      const before = content.substring(0, mapStart);
      const after = content.substring(current);
      const replacement = `{/* Following list would load from API */}\n            <div style={{ padding: '40px 20px', textAlign: 'center' }}>\n              <span style={{ color: '#888', fontSize: 13 }}>Following list would load from API</span>\n            </div>`;
      
      content = before + replacement + after;
      console.log('✓ Removed mock following map');
    }
  }
  
  // 3. Also remove any remaining mockFollowers references
  content = content.replace(/mockFollowers\./g, '[]');
  content = content.replace(/mockFollowers/g, '[]');
  content = content.replace(/displayUser\?\.followerCount \|\| 0 - 2/g, 'displayUser?.followingCount || 0');
  
  console.log('✓ Removed remaining mockFollowers references');
  
  // 4. Save the file
  fs.writeFileSync(profilePath, content);
  
  console.log('\n✅ All mock data removed from Profile.jsx');
  
  // Run verification
  console.log('\n=== VERIFICATION ===');
  const { execSync } = require('child_process');
  try {
    const result = execSync('node scratch/test_phase14_production_integrity.js', { 
      cwd: path.join(__dirname, '..'), 
      encoding: 'utf8' 
    });
    console.log(result);
  } catch (error) {
    console.log('Verification output:');
    console.log(error.stdout || error.message);
  }
  
} catch (error) {
  console.error('Error:', error.message);
}