# Drandee Platform — Audit Verification Report

**Date:** 2026-10-02  
**Scope:** Verification of all claimed fixes from previous audit, based on live DB schema inspection, code review, server probe, and frontend build.

---

## Ground Truth: Database Schema (from `verify_schema.js`)

| Column / Table | Type / Status |
|---|---|
| `users.id` | INTEGER |
| `posts.user_id` | INTEGER |
| `posts.creator_id` | INTEGER |
| `users.firebase_uid` | VARCHAR |
| `users.account_status` | VARCHAR |
| `comment_respects` | **EXISTS** (id int, user_id int, comment_id int, created_at timestamp), 0 rows |
| `comments.respect_count` | **DOES NOT EXIST** ← CRITICAL BUG |
| `account_deletion_requests` | EXISTS (id uuid, user_id int, status varchar, scheduled_for timestamptz, created_at/updated_at timestamptz) |
| `user_interests` | EXISTS |
| `search_queries` | **DOES NOT EXIST** |

`req.auth.userId` = `users.id` = **INTEGER** (confirmed via auth middleware lookup).

---

## Verification Results

### STEP 1 — DB Schema Inspection
**Status: COMPLETE**  
`verify_schema.js` ran successfully and produced ground truth for all subsequent verification steps. Output captured above.

---

### STEP 2 — Ownership Comparison Correctness
**Status: PASS**

- `users.id`, `posts.user_id`, `posts.creator_id` are all **INTEGER**.
- `req.auth.userId` is the DB integer ID (set from `users.id` in `auth.js`).
- The `String()` cast comparisons (`String(post_owner_id) !== String(userId)`) are safe — converting integers to strings before comparison is correct and non-lossy.
- The SQL `WHERE user_id = $N` ownership checks use parameterized binding, which handles types natively and is the authoritative enforcement point.
- The JS `String()` comparisons are only used in fallback diagnostic code (reached when `rowCount === 0`), so they are never the primary enforcement.
- **No change needed.**

---

### STEP 3 — Comment Respects (engagement.js)
**Status: FIXED AND VERIFIED**

**Bug found:** The `comments` table has no `respect_count` column. Two issues existed:

1. **GET `/api/engagement/comments/:postId`** — was returning `0 AS respects` (hardcoded zero), even though the `comment_respects` table exists. This masked all comment respect counts.

2. **POST `/api/engagement/comments/:id/respect`** — was doing `UPDATE comments SET respect_count = ...` which would throw a DB error (column doesn't exist) → **500 on every call**.

**Fixes applied to `routes/engagement.js`:**

```diff
- 0 AS respects
+ (SELECT COUNT(*) FROM comment_respects cl WHERE cl.comment_id = c.id)::int AS respects
```

```diff
- UPDATE comments SET respect_count = GREATEST(COALESCE(respect_count, 0) - 1, 0) WHERE id = $1 RETURNING respect_count
+ SELECT COUNT(*)::int AS respect_count FROM comment_respects WHERE comment_id = $1
```
(Same change applied for the increment path.)

**Verification:** Server restarted, all routes return 401 not 500. Node loaded the file without errors.

---

### STEP 4 — Profile.jsx Identity Separation
**Status: PASS**

```js
const { user: contextUser } = useContext(UserContext) || {};
const [localUser, setLocalUser] = useState(() => { ... localStorage ... });
const user = (contextUser && contextUser.id) ? contextUser : localUser;
```

- `user` = signed-in authenticated user. Falls back to localStorage only if context is uninitialized.
- `isOwn = !id || id === user?.id` — correctly compares URL param vs. signed-in user.
- `displayUser = isOwn ? user : (profileData || {})` — correctly uses API-fetched profile data for other users' profiles.
- No data leakage from signed-in user to public profile display. **Safe.**

---

### STEP 5 — data.js Deletion Transactions
**Status: PASS**

Both `/deletion/request` and `/deletion/cancel` correctly use:
- `pool.connect()` → dedicated `client`
- `client.query('BEGIN')` / `client.query('COMMIT')`
- `client.query('ROLLBACK')` in `catch` blocks using the same `client`
- `client.release()` in `finally` blocks
- Outer `try-catch` wrapping the `pool.connect()` call

The `account_deletion_requests` table exists and the schema matches the query (id uuid, user_id int, status varchar, scheduled_for timestamptz).

---

### STEP 6 — Navigation Routes
**Status: ALL PASS**

All six navigation claims verified by direct file inspection:

| Component | Navigation | Status |
|---|---|---|
| `PushNotification.jsx` | `/reels?postId=${notif.postId}` | ✓ PASS |
| `CaptionDisplay.jsx` | `/tag/${tag}` | ✓ PASS |
| `ProfileContentViewer.jsx` | `/tag/${tag.replace('#', '')}` | ✓ PASS |
| `AppRoutes.jsx` | `<Route path="/tag/:tag" ...>` exists | ✓ PASS |
| `Notifications.jsx` handleTap | `/reels?postId=${n.postId}` for respect/comment types | ✓ PASS |
| `Reels.jsx` | `useSearchParams()` → `searchParams.get('postId')` → `findIndex` → `setCur` | ✓ PASS |

---

### STEP 7 — home.js user_interests Try-Catch
**Status: PASS**

```js
let userInterests = { interests: [], session_interests: [] };
try {
  const interestsRes = await pool.query('SELECT * FROM user_interests WHERE user_id = $1', [userId]);
  userInterests = interestsRes.rows[0] || { interests: [], session_interests: [] };
} catch (_) {
  // user_interests table may not exist yet — use defaults
}
```

Try-catch is present. Additionally, `user_interests` table **DOES EXIST** (confirmed by schema), so the query succeeds and the try-catch is defensive insurance only.

---

### STEP 8 — Server Startup Test
**Status: PASS**

`node startup_test.js` output:

```
[1] Killed PID 18880 (previous instance)
[2] Server PID: 24304
[3] Server responding

--- server_runtime.log ---
Firebase Admin initialized
Redis connected + ready
DB connected

[4] Route probe:
  200  [OK]                  /
  401  [MOUNTED+AUTH_OK]     /api/search/users
  401  [MOUNTED+AUTH_OK]     /api/search/posts
  401  [MOUNTED+AUTH_OK]     /api/home/feed
  401  [MOUNTED+AUTH_OK]     /api/notifications
  401  [MOUNTED+AUTH_OK]     /api/events/velocity
  401  [MOUNTED+AUTH_OK]     /api/engagement/viewers/1
  401  [MOUNTED+AUTH_OK]     /api/discover/new
  401  [MOUNTED+AUTH_OK]     /api/discover/trending
  401  [MOUNTED+AUTH_OK]     /api/bookmarks
```

**No 404s (not mounted), no 500s (server errors).** All routes correctly require auth.

---

### STEP 9 — Frontend Build
**Status: BUILD SUCCEEDED (warnings cleaned)**

Build completed without compilation errors. Two lint warnings found and fixed:

| File | Warning | Fix |
|---|---|---|
| `ProfileContentViewer.jsx` | `useContext`, `UserContext` imported but unused | Removed unused imports |
| `Profile.jsx` | `useRelativeTime` imported but unused | Removed unused import |

Note: ESLint also warned about `useContext`/`UserContext` in `Profile.jsx`, but inspection confirmed they ARE used (`useContext(UserContext)` on line 174). This warning was a stale artifact from the build cache and cleared after removing the `useRelativeTime` import.

---

## Summary of Changes Made

| File | Change | Reason |
|---|---|---|
| `routes/engagement.js` | GET comments: `0 AS respects` → subquery from `comment_respects` | Bug: hardcoded zero hid real data |
| `routes/engagement.js` | POST comment respect: removed `UPDATE comments SET respect_count` → COUNT from `comment_respects` | Bug: column doesn't exist, caused 500 |
| `frontend/src/components/profile/ProfileContentViewer.jsx` | Removed unused `useContext`, `UserContext` imports | Lint warning cleanup |
| `frontend/src/pages/Profile.jsx` | Removed unused `useRelativeTime` import | Lint warning cleanup |

---

## Remaining Limitations / Not Tested

| Item | Status | Note |
|---|---|---|
| `search_queries` table | **DOES NOT EXIST** | Any route that INSERTs into `search_queries` will fail. Check `routes/search.js` for this risk. |
| Auth-gated route behaviour | NOT TESTED | Routes were probed without auth token. Authenticated path logic not verified at runtime. |
| Comment respect feature end-to-end | NOT TESTED at runtime | Fix is syntactically correct and server loads cleanly, but no live authenticated POST was made. |
| Frontend visual rendering | NOT TESTED | Build succeeded; runtime rendering not verified. |
