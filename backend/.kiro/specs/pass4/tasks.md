# Implementation Plan: Pass 4 — Drandee Bug Fixes

## Overview

Fixes 9 browser-reproduced bugs plus security and performance items. Execution order: Task 1 (pre-work) → Task 2 (viewers 403) → Task 3 (respect count/color/sync) → Task 4 (CHECKPOINT) → Tasks 5–9 (remaining bugs) → Task 10 (security) → Task 11 (performance) → Task 12 (final verification). Task 4 is a hard gate: the owner must confirm 5 manual tests pass before Tasks 5–9 start.

Protected files — must never be modified: `feedRanker.js`, `feedExperiment.js`, `middleware/auth.js`, `rankingEngine.js`, `engagementVelocity.js`, `config/firebase.js`, `.env`.

## Tasks

- [ ] 1. Pre-work: DB audit, table alignment, baseline greps
  - [ ] 1.1 Run DB trigger query: `SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table IN ('posts', 'respects', 'user_post_respects') ORDER BY event_object_table, event_manipulation;` and paste raw output. If any trigger increments total_respects, document it and pause before continuing.
  - [ ] 1.2 Confirm engagement.js writes only to `respects` table (not `user_post_respects`): grep routes/engagement.js for `user_post_respects` — expected zero matches. Confirm all has_respected EXISTS subqueries in postModel.js (~lines 220, 360, 423) use `FROM respects`. Confirm feedProfileModel.js ~line 79 reads `FROM respects`. Document: user_post_respects is a legacy table — do NOT alter or drop without owner approval.
  - [ ] 1.3 Run saved_posts schema query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'saved_posts' ORDER BY ordinal_position; SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'saved_posts';` — paste output; confirm unique index on (user_id, post_id) exists.
  - [ ] 1.4 Run from backend/: `findstr /N "ORDER BY" migrations\add_performance_indexes.js` — paste output; confirm shows `id DESC` not `created_at` for feed_impressions deduplication.
  - [ ] 1.5 Run from backend/: `grep -rn "message.*err\.message\|message.*error\.message" routes/ server.js` — paste full output as baseline before Phase 8.

- [ ] 2. Phase 1: Fix viewers endpoint ownership and client-side guard (Bug 7)
  - [ ] 2.1 In `backend/routes/engagement.js` ~line 1001, change ownership query from `AND user_id = $2` to `AND (user_id = $2 OR creator_id = $2)` and change `parseInt(req.query.limit, 10) || 20` to `Math.min(parseInt(req.query.limit, 10) || 20, 100)`.
  - [ ] 2.2 In `backend/frontend/src/components/home/PostActions.jsx` ~line 115, change `onViews && onViews(post.id)` to `onViews && onViews(post.id, post.creator?.id)`.
  - [ ] 2.3 In `backend/frontend/src/pages/Home.jsx`, add `user` to the useContext(UserContext) destructure if not present, then change `onViewsClick: (postId) => setActiveViewsPostId(postId)` to `onViewsClick: (postId, creatorId) => { if (String(creatorId) === String(user?.id)) { setActiveViewsPostId(postId); } }`.
  - [ ] 2.4 In `backend/frontend/src/components/home/ViewersModal.jsx` after the fetch call ~line 22, add: `if (res.status === 403 || res.status === 404) { setViewers([]); setLoading(false); return; }`.

- [ ] 3. Phase 2: Fix respect count, active color, and cross-screen sync (Bugs 1 + 2 + 4)
  - [ ] 3.1 In `backend/frontend/src/components/home/PostActions.jsx`, change the three useState initializers: `hasRespected` from `userInteraction.hasRespected || false` to `userInteraction.hasRespected ?? post.has_respected ?? post.hasRespected ?? false`; `respects` from `stats.respects || 0` to `stats.respects ?? post.totalRespects ?? post.respects ?? 0`; `hasSaved` from `userInteraction.hasSaved || false` to `userInteraction.hasSaved ?? post.has_saved ?? post.hasSaved ?? false`. Leave the existing useEffect sync block unchanged.
  - [ ] 3.2 In `backend/frontend/src/context/UserContext.jsx` giveRespect, in the optimistic setPosts call (~line 315), add `stats: { ...(p.stats || {}), respects: newCount }` alongside `totalRespects: newCount`.
  - [ ] 3.3 In the rollback setPosts in the catch block (~line 345), apply the same pattern: also update `stats: { ...(p.stats || {}), respects: rollbackCount }`.
  - [ ] 3.4 In the server-reconciliation setPosts block (~line 455), also update `stats: { ...(p.stats || {}), respects: serverTotal }` so the final count is SET from the server-returned value, not accumulated.
  - [ ] 3.5 Run `npm run build` from `backend/frontend/` and paste the real build output — must show `Compiled successfully`, zero warnings.

- [ ] 4. CHECKPOINT — owner manual tests (hard gate before Tasks 5–9)
  - [ ] 4.1 Owner opens Home feed, taps respect once on any post: count increments by exactly 1 with no intermediate flicker; Network tab shows exactly one POST to /api/engagement/respect/:id. Tap again: count decrements by 1 with no flicker. Report PASS or FAIL.
  - [ ] 4.2 Owner respects a post (icon turns colored), hard-refreshes (Ctrl+Shift+R): same post immediately shows the colored active icon without any tap. Report PASS or FAIL.
  - [ ] 4.3 Owner respects post X in Home feed, navigates to Reels, finds post X: shows updated count and active icon. Un-respects from Reels, navigates back to Home: count reverts. Report PASS or FAIL.
  - [ ] 4.4 Owner respects a post from Profile viewer, navigates to Home feed: same post shows updated count and active icon. Report PASS or FAIL.
  - [ ] 4.5 Owner taps eye/views icon on an owned post: viewers sheet opens without console errors. Taps eye on someone else's post: nothing opens, no 403 in console. Report PASS or FAIL.

- [ ] 5. Phase 3: Add has_respected and has_saved to home.js feed (Bug 3)
  - [ ] 5.1 Run these two SQL queries in the Neon DB console with a real userId and paste results: `SELECT p.id, EXISTS(SELECT 1 FROM respects r WHERE r.post_id=p.id AND r.user_id=<ID>) AS has_respected FROM posts p JOIN users u ON p.user_id=u.id WHERE NOT p.is_deleted LIMIT 5;` and `SELECT p.id, EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id=p.id AND sp.user_id=<ID>) AS has_saved FROM posts p JOIN users u ON p.user_id=u.id WHERE NOT p.is_deleted LIMIT 5;`. Confirm both return boolean columns without error before editing home.js.
  - [ ] 5.2 In `backend/routes/home.js` ~line 52, add to the candidateQuery SELECT list: `EXISTS(SELECT 1 FROM respects r WHERE r.post_id=p.id AND r.user_id=$1) AS has_respected,` and `EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id=p.id AND sp.user_id=$1) AS has_saved`. `$1` is already userId — no parameter index changes.
  - [ ] 5.3 In `backend/routes/home.js` ~line 97, replace `const formattedPosts = finalFeed.map(formatPost);` with: `const candidateById = new Map(candidateRows.map(r => [r.id, r])); const formattedPosts = finalFeed.map(rankedPost => { const original = candidateById.get(rankedPost.id); return formatPost(original ? { ...original, ...rankedPost } : rankedPost); });` This re-merge ensures caption, tags, overlay_text, has_respected, has_saved survive even if rankingEngine strips them (Phase 6 caption/tags fix is included here).

- [ ] 6. Phase 4: ProfileContentViewer — viewers sheet (Bug 8)
  - [ ] 6.1 In `backend/frontend/src/components/profile/ProfileContentViewer.jsx`, add `const [activeViewersPostId, setActiveViewersPostId] = useState(null);` to the modal state block and add `handleViewers` after handleMore: `const handleViewers = useCallback((postId, creatorId) => { if (String(creatorId) === String(user?.id)) { setActiveViewersPostId(postId); } }, [user?.id]);`. Verify user is available from the existing useContext(UserContext) destructure.
  - [ ] 6.2 Add `onViewsClick: handleViewers` to the interactionProps object passed to FeedItem.
  - [ ] 6.3 Add `import { ViewersModal } from '../home/ViewersModal';` to imports, then after the MoreMenu closing tag (outside the scroll container), add: `{activeViewersPostId && (<ViewersModal isOpen={true} postId={activeViewersPostId} onClose={() => setActiveViewersPostId(null)} />)}`.

- [ ] 7. Phase 5: ProfileContentViewer — vertical swipe and keyboard navigation (Bug 9)
  - [ ] 7.1 In `backend/frontend/src/components/profile/ProfileContentViewer.jsx`, add `const touchStartYRef = useRef(null);` alongside existing refs.
  - [ ] 7.2 Add keyboard navigation useEffect: listen for ArrowDown/ArrowUp keydown events on window; on ArrowDown call setCurrentIndex(currentIndex+1) and containerRef.current?.scrollTo({top: next * window.innerHeight, behavior: 'smooth'}); on ArrowUp call setCurrentIndex(currentIndex-1) with same scroll; cleanup removeEventListener on unmount. Deps: [currentIndex, viewerPosts.length].
  - [ ] 7.3 Add touch intercept useEffect (empty deps array, runs once on mount): attach touchstart (passive:true), touchmove (passive:false), touchend (passive:true) to containerRef.current. In touchmove: compute deltaY = currentTouchY - touchStartYRef.current; find inner card via e.target.closest('.overflow-y-auto'); check atTop (scrollTop<=0) and atBottom (scrollTop >= scrollHeight-clientHeight-1); call e.preventDefault() only when (deltaY<-10 && atBottom) OR (deltaY>10 && atTop). This prevents inner card from consuming cross-boundary swipes. Cleanup removeEventListener on unmount.
  - [ ] 7.4 Note: passive:false on touchmove is required for e.preventDefault() and does not cause warnings when attached via addEventListener. Horizontal carousel swipes in CarouselPost use their own handlers and are not intercepted (the outer container is not the target of those events).

- [ ] 8. Phase 7: Fix markWatched to call /api/watch/track (Bug 6)
  - [ ] 8.1 In `backend/frontend/src/context/UserContext.jsx` markWatched (~line 672), replace the single `await fetch('/api/home/impression', ...)` with two fire-and-forget calls (no await, each with .catch(()=>{})): one to `/api/home/impression` with `{postId, action: 'view'}` (feed algorithm signal, keep), and one to `/api/watch/track` with `{post_id: postId, watch_time: 0}` (increments posts.watch_count on first unique watch; watch.js deduplicates via ON CONFLICT(user_id,post_id) on watch_sessions; markWatched also deduplicates via user.watchedPosts).
  - [ ] 8.2 Run `SELECT watch_count FROM posts WHERE id = <postId>` before and after viewing a post in the browser — paste both query results to confirm watch_count incremented by 1 on first view and did not change on second view.

- [ ] 9. Phase 8: Remove err.message from API responses
  - [ ] 9.1 In `backend/routes/engagement.js` ~line 148, remove `message: err.message` from the respect endpoint 500 response object. Keep the console.error above it.
  - [ ] 9.2 In `backend/routes/home.js` ~line 145, change `message: error.message` to `...(process.env.NODE_ENV === 'development' && { details: error.message })`.
  - [ ] 9.3 Run post-fix grep from `backend/`: `grep -rn "message.*err\.message\|message.*error\.message" routes/ server.js` — paste full output. Confirm zero matches in engagement.js and home.js JSON response bodies. Confirm server.js ~line 767 still uses NODE_ENV gate (correct, no change).

- [ ] 10. Phase 9: Performance migration evidence (no code change)
  - [ ] 10.1 Run from `backend/`: `findstr /N "ORDER BY" migrations\add_performance_indexes.js` — paste output; confirm shows `id DESC`. Do NOT re-run the migration (unique constraint already exists in DB).

- [ ] 11. Final verification: build, server, e2e, protected files
  - [ ] 11.1 Run `npm run build` from `backend/frontend/` — paste real output; must show `Compiled successfully`, zero warnings.
  - [ ] 11.2 Start server: run `node startup_test.js` from `backend/` (background) — paste startup log lines confirming Firebase, Redis, DB connected, port 5000.
  - [ ] 11.3 Run e2e: `node tests/e2e_authenticated.js > e2e_pass4.log 2>&1` — paste tail of log and server log entries; confirm all unauthenticated routes return 401, no 500s from modified routes.
  - [ ] 11.4 Run `git diff --name-only HEAD` — paste output; confirm none of these appear: feedRanker.js, feedExperiment.js, middleware/auth.js, rankingEngine.js, engagementVelocity.js, config/firebase.js.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"],
      "description": "Pre-work audits — must complete before any code change"
    },
    {
      "wave": 2,
      "tasks": ["2"],
      "description": "Phase 1: viewers endpoint fix — independent of respect bugs"
    },
    {
      "wave": 3,
      "tasks": ["3"],
      "description": "Phase 2: respect count, active color, cross-screen sync"
    },
    {
      "wave": 4,
      "tasks": ["4"],
      "description": "CHECKPOINT: owner manual tests — hard gate before waves 5-7"
    },
    {
      "wave": 5,
      "tasks": ["5", "6", "8", "9"],
      "description": "Phases 3-8 in parallel: home feed subqueries, PCV sheets, views count, security"
    },
    {
      "wave": 6,
      "tasks": ["7"],
      "description": "Phase 5: vertical swipe — depends on Phase 4 (Task 6) sheets being complete"
    },
    {
      "wave": 7,
      "tasks": ["10"],
      "description": "Phase 9: performance evidence (no code change)"
    },
    {
      "wave": 8,
      "tasks": ["11"],
      "description": "Final verification"
    }
  ]
}
```

## Notes

- `user_post_respects` exists in the DB but is never written by active code. It is a legacy table. Do NOT alter, drop, or migrate it without explicit owner approval.
- `respects_backup` is a backup table — never read, written, or touched.
- `respects` has a unique index on `(user_id, post_id)`. The `ON CONFLICT DO NOTHING` in engagement.js is the correct deduplication mechanism.
- `saved_posts` is the single source of truth for save state.
- All "EXECUTED" verification items require pasting real command output. "NOT VERIFIED" items require owner browser testing.
- The touchmove listener uses `{ passive: false }` intentionally — required for `e.preventDefault()`. Attaching via `addEventListener` (not JSX) avoids React's passive-listener warning.
- Task 4 is a hard gate. Tasks 5, 6, 7 must not start until the owner reports all 5 checkpoint tests as PASS.
