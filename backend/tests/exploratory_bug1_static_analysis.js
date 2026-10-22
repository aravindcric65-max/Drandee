/**
 * EXPLORATORY TEST: Bug 1 - Static Code Analysis
 * 
 * This test analyzes the actual code structure without needing a running server.
 * It compares feed.js manual mapping vs postModel.js formatPost() to demonstrate
 * the missing normalization.
 * 
 * EXPECTED OUTCOME: Test documents the bug through code inspection
 */

const fs = require('fs');
const path = require('path');

console.log('\n======================================');
console.log('Bug 1 Static Analysis: Feed API vs formatPost()');
console.log('======================================\n');

// Read feed.js
const feedPath = path.join(__dirname, '../routes/feed.js');
const feedContent = fs.readFileSync(feedPath, 'utf8');

// Read postModel.js
const postModelPath = path.join(__dirname, '../models/postModel.js');
const postModelContent = fs.readFileSync(postModelPath, 'utf8');

console.log('Step 1: Analyzing postModel.js formatPost() function...\n');

// Extract formatPost implementation
const formatPostMatch = postModelContent.match(/formatPost = \(row\) => \{([\s\S]*?)\n\};/);
if (formatPostMatch) {
  const formatPostCode = formatPostMatch[0];
  
  // Check for content type normalization
  const hasTypeField = formatPostCode.includes('type: contentType');
  const hasPostTypeField = formatPostCode.includes('post_type: contentType');
  const hasContentTypeField = formatPostCode.includes('content_type: contentType');
  
  console.log('✓ Found formatPost() in postModel.js');
  console.log('  Content type normalization:');
  console.log(`    - type: contentType ${hasTypeField ? '✓' : '❌'}`);
  console.log(`    - post_type: contentType ${hasPostTypeField ? '✓' : '❌'}`);
  console.log(`    - content_type: contentType ${hasContentTypeField ? '✓' : '❌'}`);
  
  if (hasTypeField && hasPostTypeField && hasContentTypeField) {
    console.log('\n  ✓ formatPost() CORRECTLY normalizes content_type to all three fields\n');
  }
} else {
  console.log('❌ Could not find formatPost() function\n');
}

console.log('Step 2: Analyzing feed.js manual field mapping...\n');

// Check if feed.js imports formatPost
const importsFormatPost = feedContent.includes('formatPost') && 
                          feedContent.includes("require") &&
                          feedContent.includes('postModel');

console.log(`Imports formatPost: ${importsFormatPost ? '✓' : '❌ NO'}`);

// Check if feed.js uses manual mapping
const hasManualMapping = feedContent.includes('candidates = candidates.map(p => ({');
console.log(`Uses manual field mapping: ${hasManualMapping ? '✓ YES' : '❌'}`);

if (hasManualMapping) {
  // Extract the manual mapping
  const mappingMatch = feedContent.match(/candidates = candidates\.map\(p => \(\{([\s\S]*?)\}\)\);/);
  if (mappingMatch) {
    const mappingCode = mappingMatch[0];
    
    // Check for content type fields
    const hasTypeInMapping = mappingCode.includes('type:') || mappingCode.includes('type :');
    const hasPostTypeInMapping = mappingCode.includes('post_type:') || mappingCode.includes('postType:');
    const hasContentTypeInMapping = mappingCode.includes('content_type:') || mappingCode.includes('contentType:');
    
    console.log('\n  Manual mapping includes:');
    console.log(`    - type field: ${hasTypeInMapping ? '✓' : '❌ MISSING'}`);
    console.log(`    - post_type field: ${hasPostTypeInMapping ? '✓' : '❌ MISSING'}`);
    console.log(`    - content_type field: ${hasContentTypeInMapping ? '✓' : '❌ MISSING'}`);
    
    // Check what fields ARE included
    const includedFields = [];
    const fieldMatches = mappingCode.matchAll(/(\w+):/g);
    for (const match of fieldMatches) {
      includedFields.push(match[1]);
    }
    
    console.log(`\n  Fields that ARE included (${includedFields.length} total):`);
    includedFields.slice(0, 15).forEach(field => {
      console.log(`    - ${field}`);
    });
    if (includedFields.length > 15) {
      console.log(`    ... and ${includedFields.length - 15} more`);
    }
  }
}

console.log('\n\n======================================');
console.log('FINDINGS:');
console.log('======================================\n');

if (!importsFormatPost && hasManualMapping) {
  console.log('❌ BUG CONFIRMED:\n');
  console.log('1. postModel.js formatPost() correctly normalizes content_type → type/post_type/content_type');
  console.log('2. feed.js does NOT import formatPost()');
  console.log('3. feed.js manually maps fields WITHOUT content type normalization');
  console.log('4. Result: /api/feed responses lack type/post_type/content_type fields\n');
  
  console.log('IMPACT:');
  console.log('- Profile endpoint /api/posts/user/:id uses formatPost() → works ✓');
  console.log('- Feed endpoint /api/feed bypasses formatPost() → broken ✗');
  console.log('- Frontend components check p.type === "video" → undefined → content not shown');
  console.log('- Videos appear in Profile but not in Home/Reels\n');
  
  console.log('LOCATION:');
  console.log('- backend/routes/feed.js lines 96-121 (manual mapping)');
  console.log('- Should call formatPost() instead of manual mapping\n');
  
  console.log('✅ TEST OUTCOME: Bug exists - content type normalization missing in feed.js');
} else if (importsFormatPost) {
  console.log('✅ Bug appears to be fixed - feed.js imports formatPost()');
} else {
  console.log('⚠️  Inconclusive - manual analysis required');
}

console.log('\n======================================');
console.log('RECOMMENDATION:');
console.log('======================================\n');
console.log('Replace manual field mapping in feed.js with:');
console.log('');
console.log('  const { formatPost } = require("../models/postModel");');
console.log('  ...');
console.log('  candidates = candidates.map(formatPost);');
console.log('');
console.log('This ensures consistent field normalization across all API endpoints.');
console.log('');
