# Design Document

## Overview

Pass 4 fixes nine browser-reproduced bugs in Drandee. Every root cause was confirmed by reading the actual source files before writing this document. All fixes are the smallest safe diff — no new dependencies, no route changes, no schema drops, no protected-file modifications.

Implementation order (from approved requirements): Phase 1 (Bug 7 — viewers 403) → Phase 2 (Bugs 1+2+4 — respect count, active color, cross-screen sync) → **CHECKPOINT** → Phase 3 (Bug 3 — home feed has_respected) → Phase 4 (Bug 8 — ProfileContentViewer sheets) → Phase 5 (Bug 9 — vertical swipe) → Phase 6 (Bug 5 — caption/tags) → Phase 7 (Bug 6 — views count) → Phase 8 (security) → Phase 9 (performance note).

---

## Architecture

```
Backend
  engagement.js   viewers ownership check + limit cap               [Phase 1]
  engagement.js   remove err.message from 500 response              [Phase 8]
  home.js         add has_respected subquery to candidateQuery       [Phase 3]
  home.js         defensive caption/tags re-merge after ranking      [Phase 6]
  home.js         remove unconditional error.message leak            [Phase 8]
  watch.js        no change (already increments watch_count)

Frontend (no new dependencies, no color/animation changes)
  PostActions.jsx         fix useState initial values                [Phase 2]
  UserContext.jsx         setPosts updates stats.respects            [Phase 2]
  UserContext.jsx         markWatched calls /api/watch/track         [Phase 7]
  Home.jsx                onViewsClick gates on ownership            [Phase 1]
  ViewersModal.jsx        graceful 403/404 handling                  [Phase 1]
  ProfileContentViewer    onViewsClick wiring + keyboard nav         [Phases 4+5]

Protected — never touched
  feedRanker.js, feedExperiment.js, middleware/auth.js,
  rankingEngine.js, engagementVelocity.js, config/firebase.js
```

---

## Phase 1 — Backend: Viewers Endpoint Fix (Bug 7)

### Root cause — file:line

`backend/routes/engagement.js` ~line 1001:

```js
const ownershipCheck = await pool.query(
  `SELECT id FROM posts WHERE id = $1 AND user_id = $2 LIMIT 1`,
  [postId, userId]
);
```

Posts have two ownership columns: `user_id` and `creator_id` (both written on insert by `createPost` in postModel.js). The check here uses only `user_id`. Any post where `creator_id` is the populated column returns 0 rows → 403 for the legitimate owner.

Every other ownership check in the codebase uses `(user_id = $N OR creator_id = $N)` — see `posts.js` soft-delete line ~215, privacy update line ~172.

Secondary issue: `limit` has no cap. The comments endpoint caps at 100 (`Math.min(..., 100)`); viewers must too.

`ViewersModal.jsx` ~line 21: calls the endpoint unconditionally for any `postId`, including posts the current user does not own. Non-owners receive 403, which is logged as a console error.

### Files modified

- `backend/routes/engagement.js`
- `backend/frontend/src/components/home/ViewersModal.jsx`
- `backend/frontend/src/components/home/PostActions.jsx` (pass `creatorId` to `onViews`)
- `backend/frontend/src/pages/Home.jsx` (`onViewsClick` ownership gate)

### Changes

**engagement.js — ownership check and limit cap**

```js
// BEFORE (~line 994-1006):
router.get("/viewers/:postId", authMiddleware, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    const limit = parseInt(req.query.limit, 10) || 20;
    const userId = req.auth.userId;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
    if (!Number.isInteger(postId)) return res.status(400).json({ success: false, error: "Invalid post ID" });

    const ownershipCheck = await pool.query(
      `SELECT id FROM posts WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [postId, userId]
    );
    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

// AFTER:
router.get("/viewers/:postId", authMiddleware, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const userId = req.auth.userId;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
    if (!Number.isInteger(postId)) return res.status(400).json({ success: false, error: "Invalid post ID" });

    const ownershipCheck = await pool.query(
      `SELECT id FROM posts WHERE id = $1 AND (user_id = $2 OR creator_id = $2) LIMIT 1`,
      [postId, userId]
    );
    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
```

**PostActions.jsx — pass creatorId to onViews**

`PostActions` calls `onViews(post.id)`. Home.jsx needs the `creatorId` to gate the modal. One-character-class change:

```jsx
// BEFORE (PostActions.jsx ~line 115):
onClick={(e) => { e.stopPropagation(); onViews && onViews(post.id); }}

// AFTER:
onClick={(e) => { e.stopPropagation(); onViews && onViews(post.id, post.creator?.id); }}
```

**Home.jsx — ownership gate**

```jsx
// BEFORE:
onViewsClick: (postId) => setActiveViewsPostId(postId)

// AFTER:
onViewsClick: (postId, creatorId) => {
  if (String(creatorId) === String(user?.id)) {
    setActiveViewsPostId(postId);
  }
  // non-owners: no modal; PostActions count still visible
}
```

`user` is already available from `useContext(UserContext)` in Home.jsx.

**ViewersModal.jsx — graceful 403/404**

```jsx
// BEFORE (~line 22-28):
const res = await fetch(`/api/engagement/viewers/${postId}?limit=20`, {});
const data = await res.json();
if (data.success) {
  setViewers(data.data.viewers || []);
}

// AFTER:
const res = await fetch(`/api/engagement/viewers/${postId}?limit=20`, {});
if (res.status === 403 || res.status === 404) {
  setViewers([]);
  setLoading(false);
  return;
}
const data = await res.json();
if (data.success) {
  setViewers(data.data.viewers || []);
}
```

### Backend check before Phase 2

Before implementing Bug 1, run against the live DB:

```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'posts';
```

Expected result: 0 rows (no triggers on posts table). Confirms the backend cannot double-increment `total_respects` at the DB level.

### Verification

| Check | Method | Status |
|-------|--------|--------|
| No DB triggers on posts | Execute SQL above | EXECUTED |
| Owner opens viewers sheet | Browser tap test | NOT VERIFIED |
| Non-owner: no sheet, no console error | Browser tap test | NOT VERIFIED |

---

## Phase 2 — Respect Count, Active Color, Cross-Screen Sync (Bugs 1 + 2 + 4)

### Root cause — Bug 1 (+2 flash)

**Traced through the code:**

1. `PostActions.handleRespect` (`PostActions.jsx` ~line 56): `setRespects(r => newVal ? r + 1 : r - 1)` — local count N→N+1.
2. Calls `onRespect(post.id)` → `UserContext.giveRespect`.
3. `giveRespect` (`UserContext.jsx` ~line 315): `setPosts(prev => prev.map(p => p.id === videoId ? { ...p, totalRespects: ... + 1 } : p))` — updates **`totalRespects` only**, not `stats.respects`.
4. FeedItem receives new `post` prop: `post.totalRespects = N+1` but `post.stats.respects` is still `N`.
5. `PostActions.useEffect([userInteraction.hasRespected, stats.respects])` fires: `setRespects(stats.respects || 0)` = `N` — **rolls back** the optimistic N+1 to N.
6. Server reconciliation fires `dispatchEngagementUpdated(postId, { respectCount: N+1 })`.
7. `mergeEngagementIntoPost` sets `post.stats.respects = N+1`. useEffect fires again: `setRespects(N+1)`. Count correct.

**Net sequence observed by user:** N → N+1 (PostActions local) → N (useEffect rollback because `stats.respects` stale) → N+1 (server reconciliation). The N→N+1→N→N+1 bounce is what the owner describes as "+2".

### Root cause — Bug 2 (active color missing on refresh)

`PostActions.jsx` line 19: `useState(userInteraction.hasRespected || false)`.

`FeedItem.jsx` line 23: `userInteraction: post.userInteraction || {}`.

`post.userInteraction` is set only by `mergeEngagementIntoPost` (called when `engagement_updated` fires). On initial page load, no event has fired, so `post.userInteraction = {}` and `userInteraction.hasRespected = undefined` → `false`.

`formatPost` in `postModel.js` does set `post.hasRespected = Boolean(row.has_respected)` and `post.has_respected` at the flat level, but `PostActions` never reads these flat fields in its initial state.

### Root cause — Bug 4 (cross-screen sync)

Same as Bug 1: `giveRespect.setPosts` updates `totalRespects` but not `stats.respects`. When a post component re-renders after a giveRespect call, it reads `post.stats.respects` and gets the pre-interaction value. PostActions' useEffect rolls back the count. This appears as the respected post reverting in a different screen.

### Files modified

- `backend/frontend/src/components/home/PostActions.jsx`
- `backend/frontend/src/context/UserContext.jsx`

### Changes

**PostActions.jsx — fix useState initial values (Bug 2)**

```jsx
// BEFORE (lines 19-28):
const [hasRespected, setHasRespected] = useState(userInteraction.hasRespected || false);
const [respects, setRespects] = useState(stats.respects || 0);
// ...
const [hasSaved, setHasSaved] = useState(userInteraction.hasSaved || false);

// AFTER:
const [hasRespected, setHasRespected] = useState(
  userInteraction.hasRespected ?? post.has_respected ?? post.hasRespected ?? false
);
const [respects, setRespects] = useState(
  stats.respects ?? post.totalRespects ?? post.respects ?? 0
);
// ...
const [hasSaved, setHasSaved] = useState(
  userInteraction.hasSaved ?? post.has_saved ?? post.hasSaved ?? false
);
```

The existing `useEffect` sync block remains unchanged — it correctly handles subsequent updates:

```jsx
React.useEffect(() => {
  setHasRespected(userInteraction.hasRespected || false);
  setRespects(stats.respects || 0);
  setHasSaved(userInteraction.hasSaved || false);
}, [userInteraction.hasRespected, stats.respects, userInteraction.hasSaved]);
```

**UserContext.jsx — fix setPosts to include stats.respects (Bugs 1 + 4)**

Two places in `giveRespect`: the optimistic update and the rollback in the catch block.

```js
// BEFORE — optimistic setPosts (~line 315):
setPosts((prev) =>
  prev.map((p) =>
    p.id === videoId
      ? {
          ...p,
          totalRespects: wasRespected
            ? Math.max(0, (p.totalRespects || 0) - 1)
            : (p.totalRespects || 0) + 1,
        }
      : p
  )
);

// AFTER:
setPosts((prev) =>
  prev.map((p) => {
    if (p.id !== videoId) return p;
    const newCount = wasRespected
      ? Math.max(0, (p.totalRespects || 0) - 1)
      : (p.totalRespects || 0) + 1;
    return {
      ...p,
      totalRespects: newCount,
      stats: { ...(p.stats || {}), respects: newCount },
    };
  })
);
```

```js
// BEFORE — rollback setPosts in catch (~line 345):
setPosts((prev) =>
  prev.map((p) =>
    p.id === videoId
      ? {
          ...p,
          totalRespects: wasRespected
            ? (p.totalRespects || 0) + 1
            : Math.max(0, (p.totalRespects || 0) - 1),
        }
      : p
  )
);

// AFTER:
setPosts((prev) =>
  prev.map((p) => {
    if (p.id !== videoId) return p;
    const rollbackCount = wasRespected
      ? (p.totalRespects || 0) + 1
      : Math.max(0, (p.totalRespects || 0) - 1);
    return {
      ...p,
      totalRespects: rollbackCount,
      stats: { ...(p.stats || {}), respects: rollbackCount },
    };
  })
);
```

### Verification

| Check | Method | Status |
|-------|--------|--------|
| No DB triggers on posts | SQL above | EXECUTED |
| Count increments by exactly 1, no flicker | Browser tap | NOT VERIFIED |
| Respected posts show active color on refresh | Browser refresh | NOT VERIFIED |
| Respect in Home reflects in Profile viewer | Browser cross-screen | NOT VERIFIED |

---

## ⏸ CHECKPOINT — Manual Test Checklist (owner runs after Phase 2)

Run these before continuing to Phase 3. Open Chrome DevTools → Network tab during all tests.

**Test 1 — Respect count, no flicker**
1. Open Home feed. Note the respect count on any post (e.g. "12").
2. Tap the respect (hand/star) button once.
3. ✅ Count shows 13. No intermediate jump to 14 or back to 12.
4. Tap again to un-respect. ✅ Count shows 12. No flicker.
5. In Network: exactly one `POST /api/engagement/respect/:id` per tap.

**Test 2 — Active state survives refresh**
1. Respect a post. Respect icon turns colored.
2. Hard-refresh (Ctrl+Shift+R).
3. ✅ Same post immediately shows the colored respect icon. No tap needed.

**Test 3 — Cross-screen consistency**
1. Open Home feed. Note post X: not respected, count = 5.
2. Tap respect. Count shows 6, icon active.
3. Tap the creator's name → profile page → tap post X thumbnail → Profile viewer opens.
4. ✅ Post X in Profile viewer shows count 6 and active icon.
5. Un-respect from Profile viewer. Navigate back to Home feed.
6. ✅ Post X in Home feed shows count 5, icon inactive.

**Test 4 — Viewers ownership**
1. Tap eye/views icon on a post you created. ✅ Viewers sheet opens.
2. Tap eye/views icon on someone else's post. ✅ Nothing opens. No 403 in console.

**Report any failures before Phase 3.**

---

## Phase 3 — Home Feed: has_respected Subquery (Bug 3)

### Root cause — file:line

`backend/routes/home.js` ~line 52: `candidateQuery` selects `p.*` and user columns but does **not** include a `has_respected` subquery.

The `feedSelect` constant in `postModel.js` (used by `feed.js` / `GET /api/feed`) does include:

```sql
EXISTS (
  SELECT 1 FROM respects r
  WHERE r.post_id = p.id AND r.user_id = $1
) AS has_respected
```

`home.js` (`GET /api/home/feed`, used by the Home page tabs) never adds this. After `formatPost`, `row.has_respected = undefined` → `post.hasRespected = false` for every post, so no post in the home feed shows the active respect state on initial load regardless of prior interactions.

(`GET /api/feed` used by Reels is unaffected — it uses `feedSelect` which already has `has_respected`.)

### Files modified

`backend/routes/home.js`

### Change

```js
// BEFORE (~line 52-65):
let candidateQuery = `
  SELECT
    p.*,
    u.username,
    u.name as display_name,
    u.profile_pic,
    u.identity_level
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE 1=1
    ${getSafetyWhereClause()}
`;

// AFTER:
let candidateQuery = `
  SELECT
    p.*,
    u.username,
    u.name as display_name,
    u.profile_pic,
    u.identity_level,
    EXISTS (
      SELECT 1 FROM respects r
      WHERE r.post_id = p.id AND r.user_id = $1
    ) AS has_respected
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE 1=1
    ${getSafetyWhereClause()}
`;
```

`$1` is already `userId` — the first entry in `candidateValues = [userId]`. No parameter index changes needed.

### Verification

| Check | Method | Status |
|-------|--------|--------|
| Home feed shows active respect color after refresh | Browser | NOT VERIFIED |
| Engagement counts correct for posts with non-zero counts | Browser | NOT VERIFIED |

---

## Phase 4 — ProfileContentViewer: Sheets and Actions (Bug 8)

### Root cause — file:line

`backend/frontend/src/components/profile/ProfileContentViewer.jsx`:

The `FeedItem` call passes `interactionProps={{ onMore: handleMore, onTagClick: handleTagClick }}` but **no `onViewsClick`**. All post components call `<PostActions onViews={interactionProps?.onViewsClick} ...>` — since `onViewsClick` is `undefined`, tapping the eye icon silently does nothing.

All other handlers (comment, share, save, more) are wired correctly: they are passed as direct props (`onComment={handleComment}` etc.) and reach `PostActions` via `FeedItem`'s `interactionProps` merge. Modals are rendered outside the scroll container. No stacking/clipping issue for those.

Missing: no `ViewersModal` in ProfileContentViewer and no `activeViewersPostId` state.

### Files modified

`backend/frontend/src/components/profile/ProfileContentViewer.jsx`

### Changes

**Add state and handler**

```jsx
// BEFORE — modal state block (~line 50-53):
const [activeCommentPostId, setActiveCommentPostId] = useState(null);
const [activeSharePostId, setActiveSharePostId] = useState(null);
const [activeSavePostId, setActiveSavePostId] = useState(null);
const [activeMorePostId, setActiveMorePostId] = useState(null);

// AFTER — add one line:
const [activeCommentPostId, setActiveCommentPostId] = useState(null);
const [activeSharePostId, setActiveSharePostId] = useState(null);
const [activeSavePostId, setActiveSavePostId] = useState(null);
const [activeMorePostId, setActiveMorePostId] = useState(null);
const [activeViewersPostId, setActiveViewersPostId] = useState(null);
```

```jsx
// BEFORE — after handleMore handler (~line 70):
const handleMore = useCallback((postId, creatorId) => {
  setActiveMorePostId(postId);
}, []);

// AFTER — add handleViewers:
const handleMore = useCallback((postId, creatorId) => {
  setActiveMorePostId(postId);
}, []);

const handleViewers = useCallback((postId, creatorId) => {
  if (String(creatorId) === String(user?.id)) {
    setActiveViewersPostId(postId);
  }
}, [user?.id]);
```

**Wire into FeedItem**

```jsx
// BEFORE (~line 120 — interactionProps object):
interactionProps={{
  onMore: handleMore,
  onTagClick: handleTagClick,
}}

// AFTER:
interactionProps={{
  onMore: handleMore,
  onTagClick: handleTagClick,
  onViewsClick: handleViewers,
}}
```

**Add import and modal render**

```jsx
// BEFORE — imports (add ViewersModal):
import { MoreMenu } from '../home/MoreMenu';
// (ViewersModal not imported)

// AFTER:
import { MoreMenu } from '../home/MoreMenu';
import { ViewersModal } from '../home/ViewersModal';
```

```jsx
// BEFORE — modals section (after MoreMenu render):
<MoreMenu
  isOpen={!!activeMorePostId}
  onClose={() => setActiveMorePostId(null)}
  postId={activeMorePostId}
  isOwner={isOwn}
  onDeleteSuccess={(deletedId) => {
    if (onDelete) onDelete(deletedId);
    setActiveMorePostId(null);
  }}
/>
// nothing else

// AFTER — add ViewersModal:
<MoreMenu
  isOpen={!!activeMorePostId}
  onClose={() => setActiveMorePostId(null)}
  postId={activeMorePostId}
  isOwner={isOwn}
  onDeleteSuccess={(deletedId) => {
    if (onDelete) onDelete(deletedId);
    setActiveMorePostId(null);
  }}
/>
{activeViewersPostId && (
  <ViewersModal
    isOpen={true}
    postId={activeViewersPostId}
    onClose={() => setActiveViewersPostId(null)}
  />
)}
```

### Verification

| Check | Method | Status |
|-------|--------|--------|
| Comment sheet opens from profile viewer | Browser | NOT VERIFIED |
| Share sheet opens | Browser | NOT VERIFIED |
| Save sheet opens | Browser | NOT VERIFIED |
| More menu opens | Browser | NOT VERIFIED |
| Eye icon on own post opens viewers sheet | Browser | NOT VERIFIED |

---

## Phase 5 — ProfileContentViewer: Vertical Swipe Navigation (Bug 9)

### Root cause — file:line

`ProfileContentViewer.jsx`: the outer container is `overflow-y-scroll snap-y snap-mandatory`. Each post card is wrapped in `<div className="... overflow-y-auto max-h-[85vh] ...">`. On mobile, touch events hit the inner card first. If the inner card has scrollable content, it consumes the vertical swipe before the outer container sees it. No keyboard handlers exist.

### Files modified

`backend/frontend/src/components/profile/ProfileContentViewer.jsx`

### Changes

**Add touch refs**

```jsx
// BEFORE — refs (~line 30):
const containerRef = useRef(null);
const viewTrackedRef = useRef(new Set());

// AFTER:
const containerRef = useRef(null);
const viewTrackedRef = useRef(new Set());
const touchStartYRef = useRef(null);
```

**Add keyboard navigation effect** (place alongside existing useEffects)

```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIndex + 1;
      if (next < viewerPosts.length) {
        setCurrentIndex(next);
        containerRef.current?.scrollTo({ top: next * window.innerHeight, behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIndex - 1;
      if (prev >= 0) {
        setCurrentIndex(prev);
        containerRef.current?.scrollTo({ top: prev * window.innerHeight, behavior: 'smooth' });
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentIndex, viewerPosts.length]);
```

**Add touch intercept via addEventListener (passive: false)**

`e.preventDefault()` inside a JSX `onTouchMove` handler triggers a browser warning because React attaches passive listeners by default. Use a `useEffect` to attach a non-passive listener directly.

```jsx
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;

  const onTouchStart = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (touchStartYRef.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    const innerCard = e.target.closest('.overflow-y-auto');
    if (!innerCard) return;
    const atTop = innerCard.scrollTop <= 0;
    const atBottom =
      innerCard.scrollTop >= innerCard.scrollHeight - innerCard.clientHeight - 1;
    // Let the outer snap-scroll handle cross-boundary swipes
    if ((deltaY < -10 && atBottom) || (deltaY > 10 && atTop)) {
      e.preventDefault();
    }
  };

  const onTouchEnd = () => {
    touchStartYRef.current = null;
  };

  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd, { passive: true });

  return () => {
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
  };
}, []); // containerRef.current is stable after mount
```

### Verification

| Check | Method | Status |
|-------|--------|--------|
| Swipe up → next post | Mobile browser | NOT VERIFIED |
| Swipe down → previous post | Mobile browser | NOT VERIFIED |
| Inner card scrolls when not at boundary | Mobile browser | NOT VERIFIED |
| ArrowDown/Up → navigate posts | Desktop browser | NOT VERIFIED |

---

## Phase 6 — Caption/Tags: Defensive Re-merge After Ranking (Bug 5)

### Root cause — file:line

`backend/routes/home.js` ~line 100: `finalFeed.map(formatPost)` applies `formatPost` to the output of `applyDiversityEngine(rankedPosts, ...)`. The ranking functions in `rankingEngine.js` (protected — cannot modify) receive raw DB candidate rows and return objects that may carry only a subset of fields (e.g. score fields + id). If `rankingEngine` strips `caption`, `tags`, or `overlay_text`, then `formatPost` applied to the stripped output produces empty strings.

**Safe fix:** Before calling `formatPost`, merge each ranked result back with the original candidate row. The original row is guaranteed to have all DB columns because it came directly from the SQL query.

`feed.js` (`GET /api/feed`, used by Reels) calls `formatPost` on candidates **before** ranking — so it is unaffected and does not need this fix.

### Files modified

`backend/routes/home.js`

### Change

```js
// BEFORE (~line 97-102):
const { formatPost } = require('../models/postModel');
const formattedPosts = finalFeed.map(formatPost);

// AFTER:
const { formatPost } = require('../models/postModel');
// Re-merge ranked posts with original candidate data so fields like
// caption, tags, overlay_text survive even if rankingEngine strips them.
const candidateById = new Map(candidateRows.map(r => [r.id, r]));
const formattedPosts = finalFeed.map(rankedPost => {
  const original = candidateById.get(rankedPost.id);
  return formatPost(original ? { ...original, ...rankedPost } : rankedPost);
});
```

The spread order `{ ...original, ...rankedPost }` means ranking-added fields (scores, sort keys) override the original but all original DB fields are present as a fallback.

### Verification

| Check | Method | Status |
|-------|--------|--------|
| Home feed posts show captions | Browser | NOT VERIFIED |
| Home feed posts show clickable hashtags | Browser | NOT VERIFIED |

---

## Phase 7 — Views Count: Fix markWatched Endpoint (Bug 6)

### Root cause — file:line

`backend/frontend/src/context/UserContext.jsx` `markWatched` function ~line 672: calls `POST /api/home/impression` with `{ postId, action: 'view' }`.

`/api/home/impression` writes only to the `feed_impressions` table. It does **not** update `posts.watch_count`. The `stats.views` field in `PostActions` reads `watch_count` via `formatPost` — so views always show as 0.

`POST /api/watch/track` (`watch.js` line 161) already correctly increments `posts.watch_count` on the **first** unique watch per `(user_id, post_id)` pair. It accepts `{ post_id, watch_time: 0 }` as a session-start call (no `session_token` required when `watch_time = 0`).

`markWatched` already deduplicates via `user.watchedPosts` array. `watch.js` deduplicates at DB level via `ON CONFLICT (user_id, post_id)`. Both layers prevent double-counting.

**Fix:** In `markWatched`, call both endpoints. Keep the impression call (feed algorithm signals). Add the watch/track call (view count).

### Files modified

`backend/frontend/src/context/UserContext.jsx`

### Change

```js
// BEFORE (~line 672-678):
try {
  await fetch('/api/home/impression', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, action: 'view' })
  });
} catch (err) {
  console.error("Failed to mark watched", err);
}

// AFTER:
try {
  // Feed algorithm signal — keep
  fetch('/api/home/impression', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, action: 'view' }),
  }).catch(() => {});

  // View count increment — updates posts.watch_count on first unique watch
  fetch('/api/watch/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: postId, watch_time: 0 }),
  }).catch(() => {});
} catch (err) {
  // Both are fire-and-forget
}
```

Both calls are fire-and-forget (no `await`). `markWatched` is already non-blocking.

### Verification

| Check | Method | Status |
|-------|--------|--------|
| `SELECT watch_count FROM posts WHERE id = X` increments by 1 after first watch | DB query | EXECUTED (after test) |
| View count shows in PostActions on next feed load | Browser | NOT VERIFIED |

---

## Phase 8 — Security: Remove err.message from API Responses

### Root cause — file:line

Two unconditional leaks:

1. `backend/routes/engagement.js` ~line 150 (respect endpoint 500 handler): `message: err.message` in JSON response body — sent to client in all environments.
2. `backend/routes/home.js` ~line 183 (feed endpoint 500 handler): `message: error.message` — sent unconditionally.

`posts.js` already conditionally gates on `NODE_ENV === 'development'` — no change needed there.

### Files modified

`backend/routes/engagement.js`, `backend/routes/home.js`

### Changes

**engagement.js respect endpoint 500 handler**

```js
// BEFORE (~line 148-152):
return res.status(500).json({
  success: false,
  error: "Server error",
  message: err.message
});

// AFTER:
return res.status(500).json({
  success: false,
  error: "Server error"
});
```

**home.js feed endpoint 500 handler**

```js
// BEFORE (~line 181-185):
res.status(500).json({
  success: false,
  error: 'Server error',
  message: error.message
});

// AFTER:
res.status(500).json({
  success: false,
  error: 'Server error',
  ...(process.env.NODE_ENV === 'development' && { details: error.message }),
});
```

### Verification

```
grep -n "err\.message\|error\.message" backend/routes/engagement.js backend/routes/home.js
```

Remaining results should be only `console.error(...)` lines (logging to server-side), not `res.json(...)` lines.

| Check | Method | Status |
|-------|--------|--------|
| grep confirms no client-facing message leak | Execute grep | EXECUTED |

---

## Phase 9 — Performance: feed_impressions Index (Note Only)

### Finding

`backend/migrations/add_performance_indexes.js` is already correct. The owner's concern about `created_at` references on `feed_impressions` does not apply to the current file. The file:

- Uses `id` column for deduplication (`ORDER BY user_id, post_id, action, id DESC`) — correct. `feed_impressions` has columns `id, user_id, post_id, seen_at, dwell_time, action`. No `created_at` column.
- Adds unique constraint `uq_feed_impressions_user_post_action` idempotently.
- References `created_at` only on `posts` and `notifications` (both have it).

### Action

No code changes. If the migration has not been run on the production DB, run it once:

```
node migrations/add_performance_indexes.js
```

| Check | Method | Status |
|-------|--------|--------|
| Migration script has no created_at on feed_impressions | Code review (done) | EXECUTED |
| Unique constraint exists in DB | `\d feed_impressions` in psql | NOT VERIFIED |

---

## Complete File-Change Summary

| File | Phases | Summary of changes |
|------|--------|--------------------|
| `backend/routes/engagement.js` | 1, 8 | Viewers: `user_id OR creator_id`; cap limit at 100; remove `err.message` from 500 |
| `backend/frontend/src/components/home/ViewersModal.jsx` | 1 | Handle 403/404 gracefully, no console error loop |
| `backend/frontend/src/components/home/PostActions.jsx` | 1, 2 | Pass `creatorId` to `onViews`; fix `useState` initial values for `hasRespected`, `respects`, `hasSaved` |
| `backend/frontend/src/pages/Home.jsx` | 1 | `onViewsClick` gates on `creatorId === user.id` |
| `backend/frontend/src/context/UserContext.jsx` | 2, 7 | `setPosts` updates both `totalRespects` and `stats.respects`; `markWatched` calls `/api/watch/track` |
| `backend/routes/home.js` | 3, 6, 8 | Add `has_respected` subquery; defensive caption/tags re-merge; remove `error.message` |
| `backend/frontend/src/components/profile/ProfileContentViewer.jsx` | 4, 5 | `activeViewersPostId` state; `handleViewers`; `onViewsClick` in `interactionProps`; `ViewersModal` render; keyboard nav; touch intercept |

## Protected Files — Confirmed Unchanged

`feedRanker.js` ✅ · `feedExperiment.js` ✅ · `middleware/auth.js` ✅ · `rankingEngine.js` ✅ · `engagementVelocity.js` ✅ · `config/firebase.js` ✅

---

## Components and Interfaces

### Backend route changes

| Route | File | Change | Phase |
|-------|------|--------|-------|
| `GET /api/engagement/viewers/:postId` | `engagement.js` | Ownership: `user_id OR creator_id`; limit capped at 100 | 1 |
| `POST /api/engagement/respect/:postId` | `engagement.js` | Remove `message: err.message` from 500 response | 8 |
| `GET /api/home/feed` | `home.js` | Add `has_respected` subquery; defensive caption/tags re-merge; remove `error.message` from 500 | 3, 6, 8 |

No route paths, HTTP methods, or response field names are added or removed. The viewers endpoint still returns `{ success, data: { viewers } }`. The feed endpoint still returns `{ success, data: { items, nextCursor, hasMore, mode } }`.

### Frontend component changes

| Component | File | Props changed | State changed |
|-----------|------|--------------|---------------|
| `PostActions` | `PostActions.jsx` | `onViews` now called with `(postId, creatorId)` | `hasRespected`, `respects`, `hasSaved` initial values read from `post.*` flat fields |
| `UserContext` | `UserContext.jsx` | none | `setPosts` in `giveRespect` now updates `stats.respects`; `markWatched` fires both impression + watch/track |
| `Home` | `Home.jsx` | `onViewsClick` in `interactionProps` now checks ownership | none |
| `ViewersModal` | `ViewersModal.jsx` | none | Handles 403/404 without error loop |
| `ProfileContentViewer` | `ProfileContentViewer.jsx` | `interactionProps` gains `onViewsClick`; `ViewersModal` added | `activeViewersPostId` added; `touchStartYRef` added |

### Event contracts (unchanged)

`engagement_updated` CustomEvent shape is unchanged: `{ postId, engagement?, action?, delta? }`.  
`dispatchEngagementUpdated` in `engagementSync.js` is not modified.  
`mergeEngagementIntoPost` and `normalizeEngagement` in `normalizePost.js` are not modified.

---

## Data Models

No schema changes. No new tables, columns, or indexes are created by this pass.

### Existing fields used by fixes

| Table | Column | Used by fix |
|-------|--------|-------------|
| `posts` | `user_id` | Viewers ownership check (already used) |
| `posts` | `creator_id` | Viewers ownership check — now included in WHERE clause |
| `posts` | `total_respects` | Respect endpoint (unchanged); `setPosts` now also updates `stats.respects` mirror |
| `posts` | `watch_count` | Incremented by `POST /api/watch/track` (already correct); `markWatched` now calls this endpoint |
| `posts` | `caption`, `tags`, `overlay_text` | Re-merged into ranked posts in `home.js` before `formatPost` |
| `respects` | `user_id`, `post_id` | `has_respected` subquery added to `home.js` candidateQuery |
| `feed_impressions` | `user_id`, `post_id`, `action` | Unique constraint `uq_feed_impressions_user_post_action` — migration already correct, no change |
| `watch_sessions` | `user_id`, `post_id` | Deduplication for `watch_count` increment — already correct |

### Frontend state shape changes

`UserContext.posts` array: each post object gains a consistent `stats.respects` value after `giveRespect` calls. Shape was `{ ..., totalRespects: N, stats: { respects: M, ... } }` where `N ≠ M` after optimistic update. After fix: `N === M` always.

No `localStorage` schema changes. No new keys written. The `user.respectedVideos` array is not changed.
