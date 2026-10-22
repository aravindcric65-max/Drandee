# Tasks

## Task 1: Fix Settings loading states and scheduleDeletion logout timing

**File:** `backend/frontend/src/pages/Settings.jsx`

### 1a — NotificationsCenter: add loading state

In the `NotificationsCenter` function component:
- Add `const [loading, setLoading] = useState(true);` after the existing `useState` declarations.
- In the `useEffect`, after `apiCall('/settings/notifications').then(res => { if (res.success) setNotifs(res.notifications); ... })`, chain `.finally(() => setLoading(false))` — or set `setLoading(false)` in both the `.then` body and a `.catch`.
- At the top of the return block, add: `if (loading) return <div style={{color: '#888', padding: 16}}>Loading…</div>;`
- Ensure all 8 toggle rows are rendered: `respect`, `comment`, `follow`, `mention`, `reply`, `system`, `push`, `email`.

### 1b — AccountCenter: add loading state

In the `AccountCenter` function component:
- Add `const [loading, setLoading] = useState(true);` after the existing `useState` declarations.
- Replace the two separate `useEffect` fetch chains with a single `Promise.all([apiCall('/settings/profile'), apiCall('/settings/providers')])` that sets both state values and calls `setLoading(false)` when both settle.
- At the top of the return block, add: `if (loading) return <div style={{color: '#888', padding: 16}}>Loading…</div>;`

### 1c — DataPrivacyCenter: 2-second logout delay on deletion success

In the `DataPrivacyCenter` function component, find the `scheduleDeletion` success path where `logout()` or `logout && logout()` is called immediately after setting state. Change it from:
```js
logout && logout();
// or
if (typeof logout === 'function') logout();
```
to:
```js
if (typeof logout === 'function') setTimeout(logout, 2000);
```

**Acceptance criteria:**
- `NotificationsCenter` renders a loading indicator before the `/settings/notifications` fetch resolves.
- `AccountCenter` renders a loading indicator before the `/settings/profile` fetch resolves.
- On successful deletion scheduling, `logout` is called after ≥2 seconds, not immediately.
- No other settings behavior changes.

---

## Task 2: Harden apiInterceptor — guard redirect and deduplicate concurrent refreshes

**File:** `backend/frontend/src/apiInterceptor.js`

### 2a — Guard the /login redirect (B1)

In the `catch (refreshError)` block inside the 401 retry path, find the section that checks for network errors and then redirects. The current code looks roughly like:
```js
const isNetworkError = refreshError?.code === 'auth/network-request-failed' || ...;
if (isNetworkError) { throw refreshError; }
if (window.location.pathname !== '/login') {
  window.location.href = '/login';
}
throw new Error('Authentication invalid or expired');
```

Change it to only redirect when `auth.currentUser` is null/undefined:
```js
const isNetworkError = refreshError?.code === 'auth/network-request-failed' || refreshError?.message?.includes('network');
if (isNetworkError) { throw refreshError; }

// Only redirect when the Firebase session is genuinely gone
if (!auth.currentUser) {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  throw new Error('Authentication invalid or expired');
}
// Session is still alive — fail this request without redirecting
throw refreshError;
```

Note: `auth` is already imported at the top of `apiInterceptor.js` as `import { auth } from './firebase/config';`.

### 2b — Deduplicate concurrent 401 refresh calls (B2)

At module level, immediately after `const originalFetch = window.fetch;`, add:
```js
let refreshPromise = null;
```

In the 401 handler, find the block that calls `user.getIdToken(true)` and replace it with the shared promise pattern:
```js
if (!refreshPromise) {
  refreshPromise = user.getIdToken(true).finally(() => {
    refreshPromise = null;
  });
}
const freshToken = await refreshPromise;
```

Everything after this (header attachment, retry fetch) remains unchanged.

**Acceptance criteria:**
- When `auth.currentUser` is non-null and refresh throws a non-network error, `window.location.href` is NOT set to `/login`.
- When `auth.currentUser` is null and refresh fails, redirect still fires.
- When N concurrent requests all receive 401, `getIdToken(true)` is called exactly once.

---

## Task 3: ProfileContentViewer — remove forceAdd from handleRespect

**File:** `backend/frontend/src/components/profile/ProfileContentViewer.jsx`

Find the function (likely named `handleRespect` or an inline callback) where `giveRespect` is called and a `forceAdd` argument is passed. Change:
```js
// Before
const handleRespect = (postId, forceAdd) => {
  if (giveRespect) giveRespect(postId, forceAdd);
};
// or inline:
onEngagement={(postId, actionType, forceAdd) => {
  if (actionType === 'respect' && giveRespect) giveRespect(postId, forceAdd);
}}
```
to:
```js
// After — drop forceAdd entirely
const handleRespect = (postId) => {
  if (giveRespect) giveRespect(postId);
};
// or inline:
onEngagement={(postId, actionType) => {
  if (actionType === 'respect' && giveRespect) giveRespect(postId);
  if (actionType === 'save' && savePost) savePost(postId);
}}
```

**Acceptance criteria:**
- `giveRespect` is called with exactly one argument (`postId`) from ProfileContentViewer.
- No other engagement actions (save, share) are affected.

---

## Task 4: Reels — move incrementShare to completion handlers + fix deep-link not-found toast

**File:** `backend/frontend/src/pages/Reels.jsx`

### 4a — Move incrementShare to completion (C2)

Find the `handleShare` function (or inline share handler). Locate any call to `incrementShare(postId)` (or `incrementRespect`/share count increment) that fires before the platform action completes. Move it so it only fires after:
- For `whatsapp`, `telegram`, `twitter`, `instagram` platform opens: call `incrementShare` immediately after `window.open(...)`.
- For `navigator.share`: call `incrementShare` inside the `.then()` or after `await navigator.share(...)` in the success path only, not in the catch.
- For clipboard copy: call `incrementShare` inside the success branch after `await navigator.clipboard.writeText(...)` succeeds.
- Do NOT call `incrementShare` if the user dismisses the share sheet, closes the modal, or cancels.

If `incrementShare` is currently called at the top of the `handleShare` function before any branch, move it into each branch's success path.

### 4b — Deep-link: show "Post not found" toast and clear postId param (D2)

The current Reels.jsx reads `targetPostId = searchParams.get('postId')` and calls `setCur(idx >= 0 ? idx : 0)`. Make the following additions:

1. Ensure `useSearchParams` is destructured with both value and setter: `const [searchParams, setSearchParams] = useSearchParams();`

2. In the place where the feed is processed and `targetPostId` is used to jump to a post, add after the `setCur` call:
```js
if (targetPostId) {
  if (idx < 0) {
    // Post not in feed — show brief feedback
    setFeedbackMsg('Post not found');   // use existing feedbackMsg state if present,
                                         // otherwise add: const [deepLinkMsg, setDeepLinkMsg] = useState('');
    setTimeout(() => setFeedbackMsg(''), 3000);
  }
  // Clear the param whether found or not (prevent re-trigger on remount)
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.delete('postId');
    return next;
  }, { replace: true });
}
```

3. Render the not-found message if present — use the existing `feedbackMsg` display mechanism in Reels.jsx, or add a small inline toast element consistent with the existing UI pattern.

**Acceptance criteria:**
- Opening the share sheet without completing a share does not increment the share count.
- Completing any share (platform open, clipboard copy, or native share confirmation) increments once.
- Navigating to `/reels?postId=99999` (non-existent post) shows a brief "Post not found" message and clears the param from the URL.
- Navigating to `/reels?postId=<valid-id>` jumps to that post and clears the param.
- Navigating to `/reels` (no param) loads normally at index 0, no regression.

---

## Task 5: AppRoutes — per-route ErrorBoundary

**File:** `backend/frontend/src/routes/AppRoutes.jsx`

Add the following class component near the top of the file (after imports, before the main function):

```jsx
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#080808', color: '#fff', gap: 16 }}>
          <p style={{ fontSize: 16 }}>This page failed to load.</p>
          <a href="/" style={{ color: '#7F77DD', textDecoration: 'underline', fontSize: 14 }}>Go to home</a>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Then wrap each lazy Route's element content with `<RouteErrorBoundary>`. For example:
```jsx
// Before:
<Route path="/reels" element={<ProtectedRoute><Reels /></ProtectedRoute>} />
// After:
<Route path="/reels" element={<RouteErrorBoundary><ProtectedRoute><Reels /></ProtectedRoute></RouteErrorBoundary>} />
```

Apply to every Route that uses a lazy-loaded component. The outer `<Suspense>` boundary remains unchanged. The `RouteErrorBoundary` wraps the Route element, not the entire Routes tree.

**Make sure `React` is imported as a named import (not just hooks) since class components need `React.Component`:**
```js
import React, { Suspense, lazy } from 'react';
// or ensure React is in scope
```

**Acceptance criteria:**
- If a lazy route import throws, that route shows "This page failed to load." rather than a blank screen.
- All other routes continue to render normally.
- The Suspense loading fallback still works while routes are loading.

---

## Task 6: Create migration SQL file

**File:** `backend/migrations/add_user_prefs_columns.sql` (create new file)

```sql
-- Idempotent migration: adds preference columns to users table
-- Referenced by GET/PUT /api/settings/preferences in backend/routes/settings.js
-- Safe to run multiple times. No destructive operations.

ALTER TABLE users ADD COLUMN IF NOT EXISTS autoplay_videos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_saver_mode BOOLEAN NOT NULL DEFAULT FALSE;
```

Do NOT execute this SQL. Create the file only. The owner must run it manually against the Neon PostgreSQL database.

**Acceptance criteria:**
- File exists at `backend/migrations/add_user_prefs_columns.sql`.
- Contains only the two `ADD COLUMN IF NOT EXISTS` statements shown above.
- No other database changes are made.

---

## Task 7: Verify build and protected files

Run the following checks after all code changes:

1. **Frontend build:** `cd backend/frontend && npm run build`
   - Build must succeed with exit code 0.
   - Record any new warnings introduced by the changes.

2. **Protected files check:** `git diff -- backend/utils/feedRanker.js backend/utils/feedExperiment.js backend/utils/rankingEngine.js backend/utils/engagementVelocity.js backend/middleware/auth.js`
   - Output must be empty (no changes to any protected file).

3. **ESLint (if available):** `cd backend/frontend && npm run lint`
   - No new errors introduced. Pre-existing lint warnings are acceptable.

**Acceptance criteria:**
- Frontend build exits 0.
- Protected files show no diff.
- No new ESLint errors on changed files.
