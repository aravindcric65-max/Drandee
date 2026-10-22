/**
 * EXPLORATORY TEST: Bug 1 - Backend Feed API Missing Content Type Normalization
 * 
 * GOAL: Surface counterexamples demonstrating /api/feed returns content_type 
 * but NOT type/post_type/contentType fields.
 * 
 * EXPECTED OUTCOME: Test FAILS on unfixed code (confirms bug exists)
 * 
 * STATUS: This test is designed to FAIL on the current codebase to confirm
 * the bug exists before implementing fixes.
 */

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

// Test configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_USER_ID = process.env.TEST_USER_ID; // Should be set in .env or passed as argument

/**
 * Property 1: Bug Condition - Backend API Normalization
 * 
 * For any API response from /api/feed where posts have content_type field in database,
 * the response SHOULD include normalized contentType, type, and post_type fields.
 * 
 * BUG: Currently /api/feed bypasses formatPost() and manually maps fields,
 * missing content_type normalization.
 */
async function testFeedNormalization() {
  console.log('\n======================================');
  console.log('Bug 1 Exploration: Feed API Content Type Normalization');
  console.log('======================================\n');

  // Setup database connection using DATABASE_URL from .env
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false' 
      ? { rejectUnauthorized: false } 
      : undefined
  });

  try {
    // Step 1: Check database for posts with content_type
    console.log('Step 1: Checking database for posts with content_type...\n');
    const dbQuery = await pool.query(`
      SELECT id, content_type, video_url, image_url, caption
      FROM posts
      WHERE content_type IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (dbQuery.rows.length === 0) {
      console.log('❌ No posts found in database with content_type field');
      console.log('   Cannot test bug without test data.');
      console.log('   Recommendation: Create test posts with content_type="video", "image", "text"');
      return;
    }

    console.log(`✓ Found ${dbQuery.rows.length} posts in database with content_type:\n`);
    dbQuery.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. Post ID ${row.id}: content_type="${row.content_type}"`);
      if (row.video_url) console.log(`     - Has video_url: ${row.video_url.substring(0, 50)}...`);
      if (row.image_url) console.log(`     - Has image_url: ${row.image_url.substring(0, 50)}...`);
    });
    console.log('');

    // Step 2: Call /api/feed endpoint
    console.log('Step 2: Calling /api/feed endpoint...\n');
    
    // Get auth token (this is a simplified version - adjust based on your auth system)
    const authToken = await getAuthToken(pool);
    if (!authToken) {
      console.log('❌ Could not get auth token');
      console.log('   Set TEST_USER_ID environment variable to a valid user ID');
      return;
    }

    const response = await axios.get(`${API_BASE_URL}/api/feed?limit=10`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.data.success) {
      console.log('❌ API request failed:', response.data.error);
      return;
    }

    const posts = response.data.posts || [];
    console.log(`✓ Received ${posts.length} posts from /api/feed\n`);

    // Step 3: Analyze response for missing normalization
    console.log('Step 3: Analyzing response structure for content type fields...\n');
    
    let bugFound = false;
    const counterexamples = [];

    for (const post of posts) {
      // Check what fields are present
      const hasContentType = post.content_type !== undefined;
      const hasType = post.type !== undefined;
      const hasPostType = post.post_type !== undefined;
      const hasContentTypeNormalized = post.contentType !== undefined;

      // Match posts back to DB to know expected content_type
      const dbPost = dbQuery.rows.find(r => r.id === post.id);
      const expectedContentType = dbPost ? dbPost.content_type : 'unknown';

      console.log(`Post ID ${post.id}:`);
      console.log(`  Expected content_type from DB: "${expectedContentType}"`);
      console.log(`  API Response fields:`);
      console.log(`    - content_type: ${hasContentType ? `"${post.content_type}"` : 'MISSING ❌'}`);
      console.log(`    - type: ${hasType ? `"${post.type}"` : 'MISSING ❌'}`);
      console.log(`    - post_type: ${hasPostType ? `"${post.post_type}"` : 'MISSING ❌'}`);
      console.log(`    - contentType: ${hasContentTypeNormalized ? `"${post.contentType}"` : 'MISSING ❌'}`);

      // Check for bug condition
      const missingNormalization = (
        !hasType || 
        !hasPostType || 
        !hasContentType ||
        (hasType && dbPost && post.type !== expectedContentType) ||
        (hasPostType && dbPost && post.post_type !== expectedContentType) ||
        (hasContentType && dbPost && post.content_type !== expectedContentType)
      );

      if (missingNormalization && dbPost) {
        bugFound = true;
        counterexamples.push({
          postId: post.id,
          expectedContentType,
          actualFields: {
            content_type: post.content_type,
            type: post.type,
            post_type: post.post_type,
            contentType: post.contentType
          }
        });
        console.log('  ⚠️  BUG DETECTED: Missing or incorrect content type normalization\n');
      } else {
        console.log('  ✓ Content type fields present and correct\n');
      }
    }

    // Step 4: Report findings
    console.log('\n======================================');
    console.log('FINDINGS:');
    console.log('======================================\n');

    if (bugFound) {
      console.log('❌ BUG CONFIRMED: Content type normalization missing in /api/feed\n');
      console.log('Counterexamples found:\n');
      counterexamples.forEach((ex, idx) => {
        console.log(`${idx + 1}. Post ID ${ex.postId}:`);
        console.log(`   Expected: content_type="${ex.expectedContentType}"`);
        console.log(`   Actual API response:`);
        console.log(`     - content_type: ${ex.actualFields.content_type || 'undefined'}`);
        console.log(`     - type: ${ex.actualFields.type || 'undefined'}`);
        console.log(`     - post_type: ${ex.actualFields.post_type || 'undefined'}`);
        console.log(`     - contentType: ${ex.actualFields.contentType || 'undefined'}`);
        console.log('');
      });

      console.log('ROOT CAUSE ANALYSIS:');
      console.log('- postModel.js formatPost() correctly normalizes content_type → type/post_type/content_type');
      console.log('- /api/posts/user/:id (Profile) calls formatPost() → works ✓');
      console.log('- /api/feed manually maps fields WITHOUT formatPost() → broken ✗');
      console.log('- Location: backend/routes/feed.js lines 96-121');
      console.log('');
      console.log('IMPACT:');
      console.log('- Frontend components checking p.type === "video" fail');
      console.log('- Videos with content_type="video" don\'t appear in Reels');
      console.log('- Content visible in Profile but not in Home/Following feeds');
      console.log('');
      console.log('✅ TEST OUTCOME: FAILED as expected - bug exists on unfixed code');
    } else {
      console.log('✅ No bug found - all content type fields properly normalized');
      console.log('   This suggests the bug may already be fixed, or test data is insufficient');
    }

  } catch (error) {
    console.error('\n❌ Test execution error:', error.message);
    if (error.response) {
      console.error('   API Response:', error.response.status, error.response.data);
    }
  } finally {
    await pool.end();
  }
}

/**
 * Get authentication token for test user
 * This is a simplified implementation - adjust based on your auth system
 */
async function getAuthToken(pool) {
  try {
    // If TEST_USER_ID is provided, use it
    if (TEST_USER_ID) {
      // In production, you'd generate a proper JWT
      // For testing, we'll create a minimal token
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { userId: TEST_USER_ID },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
      return token;
    }

    // Otherwise, try to get first user from DB
    const result = await pool.query('SELECT id FROM users LIMIT 1');
    if (result.rows.length === 0) {
      return null;
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: result.rows[0].id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    return token;
  } catch (error) {
    console.error('Auth token generation error:', error.message);
    return null;
  }
}

// Run the test
if (require.main === module) {
  testFeedNormalization()
    .then(() => {
      console.log('\nTest completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nFatal error:', error);
      process.exit(1);
    });
}

module.exports = { testFeedNormalization };
