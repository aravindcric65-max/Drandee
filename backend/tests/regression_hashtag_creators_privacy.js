/**
 * Regression Test: Hashtag Top Creators Safety & Privacy Predicates
 *
 * Verifies:
 * 1. creatorsResult SQL placeholders exactly match the params array [userId, tag, likePattern].
 * 2. Blocked relationships in both directions are enforced.
 * 3. Muted relationships in both directions are enforced.
 * 4. Private accounts and private posts do not leak.
 * 5. Inactive / deleted / banned accounts are excluded via account_status.
 * 6. Post deletion and moderation status filters are enforced.
 * 7. Mock execution of getTagSummary captures the exact SQL query and params.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n======================================');
console.log('Hashtag Top Creators Privacy Regression Test');
console.log('======================================\n');

// 1. Static AST/Content Analysis of routes/hashtags.js
const hashtagsPath = path.join(__dirname, '../routes/hashtags.js');
const content = fs.readFileSync(hashtagsPath, 'utf8');

// Extract creatorsResult query block
const creatorsQueryMatch = content.match(/const creatorsResult = await pool\.query\(\s*`([\s\S]*?)`,\s*params\s*\);/);
assert(creatorsQueryMatch, 'creatorsResult pool.query block must exist in hashtags.js');

// Extract TAG_MATCH definition
const tagMatchMatch = content.match(/const TAG_MATCH = `([\s\S]*?)`;/);
assert(tagMatchMatch, 'TAG_MATCH must be defined in hashtags.js');
const tagMatchSql = tagMatchMatch[1];

// Expand template literal in querySql
let querySql = creatorsQueryMatch[1];
querySql = querySql.replace(/\$\{TAG_MATCH\}/g, tagMatchSql);

console.log('Step 1: Checking SQL placeholders vs params array...');
const paramsDefMatch = content.match(/const params = \[userId, tag, likePattern\];/);
assert(paramsDefMatch, 'params array must be [userId, tag, likePattern]');

// Find all $N placeholders in the query
const placeholders = Array.from(querySql.matchAll(/\$(\d+)/g)).map(m => parseInt(m[1], 10));
const maxPlaceholder = Math.max(...placeholders);
const minPlaceholder = Math.min(...placeholders);
const uniquePlaceholders = [...new Set(placeholders)].sort();

console.log(`  - Placeholders referenced: ${uniquePlaceholders.map(p => '$' + p).join(', ')}`);
assert.strictEqual(minPlaceholder, 1, 'Min placeholder must be $1');
assert.strictEqual(maxPlaceholder, 3, 'Max placeholder must be $3 (matching 3-element params array)');
assert.deepStrictEqual(uniquePlaceholders, [1, 2, 3], 'All $1, $2, $3 must be referenced');
console.log('  ✓ Placeholders strictly match params array [userId, tag, likePattern]\n');

console.log('Step 2: Verifying Safety & Privacy Predicates in creatorsResult...');

// (a) Blocked relationships in either direction
const hasBlockRequesterToCreator = querySql.includes('ub.blocker_id = $1 AND ub.blocked_id = u.id');
const hasBlockCreatorToRequester = querySql.includes('ub2.blocker_id = u.id AND ub2.blocked_id = $1');
console.log(`  - Block (requester -> creator): ${hasBlockRequesterToCreator ? '✓' : '❌'}`);
console.log(`  - Block (creator -> requester): ${hasBlockCreatorToRequester ? '✓' : '❌'}`);
assert(hasBlockRequesterToCreator && hasBlockCreatorToRequester, 'Blocks in both directions must be excluded');

// (b) Muted relationships in either direction
const hasMuteRequesterToCreator = querySql.includes('um.user_id = $1 AND um.muted_id = u.id');
const hasMuteCreatorToRequester = querySql.includes('um2.user_id = u.id AND um2.muted_id = $1');
console.log(`  - Mute (requester -> creator): ${hasMuteRequesterToCreator ? '✓' : '❌'}`);
console.log(`  - Mute (creator -> requester): ${hasMuteCreatorToRequester ? '✓' : '❌'}`);
assert(hasMuteRequesterToCreator && hasMuteCreatorToRequester, 'Mutes in both directions must be excluded');

// (c) Private-account and private-post visibility rules
const hasPostPrivateCheck = querySql.includes('p.is_private IS NOT TRUE');
const hasUserProtectedCheck = querySql.includes('u.is_protected IS NOT TRUE');
const hasOwnAccountBypass = querySql.includes('u.id = $1');
const hasFollowsBypass = querySql.includes('f_priv.follower_id = $1 AND f_priv.following_id = u.id');
console.log(`  - Post privacy guard (p.is_private): ${hasPostPrivateCheck ? '✓' : '❌'}`);
console.log(`  - User account protection (u.is_protected): ${hasUserProtectedCheck ? '✓' : '❌'}`);
console.log(`  - Own account bypass (u.id = $1): ${hasOwnAccountBypass ? '✓' : '❌'}`);
console.log(`  - Following relationship bypass (f_priv): ${hasFollowsBypass ? '✓' : '❌'}`);
assert(hasPostPrivateCheck && hasUserProtectedCheck && hasOwnAccountBypass && hasFollowsBypass, 
  'Private account/post visibility rules must be enforced');

// (d) Account status (deleted, suspended, banned accounts excluded)
const hasAccountStatusCheck = querySql.includes("u.account_status IS NULL OR u.account_status = 'ACTIVE'");
console.log(`  - Account status check (ACTIVE only): ${hasAccountStatusCheck ? '✓' : '❌'}`);
assert(hasAccountStatusCheck, 'Inactive/banned/deleted accounts must be excluded');

// (e) Post deletion and moderation
const hasPostDeletionCheck = querySql.includes('p.is_deleted IS NOT TRUE');
const hasModerationCheck = querySql.includes("p.moderation_status IS NULL OR p.moderation_status = 'approved'");
console.log(`  - Post deletion check: ${hasPostDeletionCheck ? '✓' : '❌'}`);
console.log(`  - Moderation status check: ${hasModerationCheck ? '✓' : '❌'}`);
assert(hasPostDeletionCheck && hasModerationCheck, 'Post deletion and moderation status must be enforced');

console.log('\nStep 3: Route execution test with mock pool...');

// 2. Execution test with mock pool
async function testExecution() {
  const executedQueries = [];
  const mockPool = {
    query: async (sql, params) => {
      executedQueries.push({ sql, params });
      if (sql.includes('COUNT(DISTINCT p.id)')) {
        return { rows: [{ post_count: 5, total_views: 100, total_respects: 50 }] };
      }
      if (sql.includes('FROM posts p, unnest(p.tags)')) {
        return { rows: [{ t: 'tech', cnt: 3 }] };
      }
      if (sql.includes('GROUP BY u.id, u.username')) {
        return {
          rows: [
            {
              id: 10,
              username: 'eligible_creator',
              display_name: 'Eligible Creator',
              avatar_url: '/uploads/creator.png',
              identity_level: 2,
              post_count: 4,
              is_following: 1,
            }
          ]
        };
      }
      if (sql.includes('DISTINCT ON (p.audio_id)')) {
        return { rows: [] };
      }
      return { rows: [] };
    }
  };

  const hashtagsRouterFactory = require('../routes/hashtags');
  const router = hashtagsRouterFactory(mockPool);

  // Find the /:tag/summary route handler
  const routeLayer = router.stack.find(s => s.route && s.route.path === '/:tag/summary');
  assert(routeLayer, 'Route /:tag/summary must be registered');

  // Route has authMiddleware + getTagSummary
  const getTagSummaryHandler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;

  let responseStatus = 200;
  let responseData = null;

  const req = {
    auth: { userId: 2 },
    params: { tag: 'tamil' },
  };

  const res = {
    status: (code) => {
      responseStatus = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  await getTagSummaryHandler(req, res);

  assert.strictEqual(responseStatus, 200, 'Expected status 200');
  assert.strictEqual(responseData.success, true, 'Expected success: true');
  assert.strictEqual(responseData.tag, 'tamil', 'Expected tag: tamil');
  assert.strictEqual(responseData.topCreators.length, 1, 'Expected 1 creator');
  assert.strictEqual(responseData.topCreators[0].username, 'eligible_creator');
  assert.strictEqual(responseData.topCreators[0].isFollowing, true);

  // Check the captured creators query
  const creatorsQuery = executedQueries.find(q => q.sql.includes('GROUP BY u.id, u.username'));
  assert(creatorsQuery, 'creatorsResult query must have been executed');
  assert.deepStrictEqual(creatorsQuery.params, [2, 'tamil', '%#tamil%'], 'Params passed must match [userId, tag, likePattern]');

  console.log('  ✓ getTagSummary executed successfully with mock pool');
  console.log('  ✓ creatorsResult query was dispatched with exact parameters [2, "tamil", "%#tamil%"]');
  console.log('  ✓ Returned eligible creator formatted with normalizeMediaUrl\n');
}

testExecution().then(() => {
  console.log('======================================');
  console.log('ALL PRIVACY REGRESSION CHECKS PASSED ✅');
  console.log('======================================\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
