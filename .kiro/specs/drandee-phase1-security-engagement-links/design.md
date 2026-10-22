# Drandee Phase 1 — Security, Engagement & Links Bugfix Design

## Overview

This design covers 14 bugs across four groups: Settings UI/API gaps (A1–A7), Auth interceptor reliability (B1–B2), Engagement logic correctness (C1–C2), and Route integrity (D1–D2). All fixes are minimal-diff and backward-compatible. The approach uses the bug-condition methodology: for every bug, a condition C(X) identifies triggering inputs, a property P(result) defines correct behavior for those inputs, and ¬C(X) defines the preservation domain where existing behavior must not change.

Several items from groups A and D are partially or fully implemented from prior sessions; this design documents their status accurately and specifies only the remaining delta.

---

## Glossary

- **Bug_Condition (C)**: A predicate that returns `true` when a given input or state triggers a defective code path.
- **Property (P)**: The required correct output or side-effect when the bug condition holds.
- **Preservation**: All behavior for inputs where C returns `false` must remain byte-for-byte identical.
- **F**: The original (unfixed) function or code path.
- **F'**: The fixed function or code path.
- **Counterexample**: A concrete C(X)=true input that demonstrates the defect on unfixed code.
- **apiCall**: The `const apiCall = async (endpoint, method, body)` helper at the top of `Settings.jsx`, used by every settings sub-component to communicate with the backend.
- **refreshPromise**: A module-level variable in `apiInterceptor.js` that holds the in-flight `getIdToken(true)` promise so all concurrent 401 waiters share a single refresh call.
- **clearSafetyCache**: A function in `engagement.js` that invalidates the memoised safety filter cache for a user, called after block/mute mutations.
- **isBugCondition(X)**: Pseudocode function defined per-bug that returns true for inputs that trigger that specific defect.

---

## Bug Details

### A1 — `apiCall` Error Handling (Settings.jsx)

**Status**: **Already fixed in prior session.** The current `apiCall` (lines 13–32 of Settings.jsx) already wraps `fetch` in `try/catch` and guards with `if (!res.ok)`, returning `{ success: false, error: ... }` for non-2xx responses. No code change required.

**Bug Condition (for reference):**
```
FUNCTION isBugCondition_A1(call)
  INPUT: call — a fetch invocation from any settings sub-component
  OUTPUT: boolean

  RETURN call result is a thrown exception (no try/catch)
      OR call result is non-2xx but treated as success (no res.ok check)
END FUNCTION
```

**Resolution**: Condition is `false` in the current codebase. No task generated.

---

### A2+A7 — NotificationsCenter and AccountCenter Loading States

**Bug Condition:**
```
FUNCTION isBugCondition_A2(component, state)
  INPUT: component — NotificationsCenter or AccountCenter React component
         state — component render state
  OUTPUT: boolean

  RETURN component.hasFetchResolved = false
     AND component.showsLoadingIndicator = false
     AND component.rendersStaleEmptyUI = true
END FUNCTION
```

**Examples:**
- User opens Notifications settings → toggles flash as `false` because `notifs` is `{}` until fetch resolves.
- User opens Account settings → name/bio fields are blank until the `/settings/profile` fetch completes.

**Affected components and current state:**
- `NotificationsCenter`: `useEffect` fires the fetch but no `loading` state exists; the 8-toggle TOGGLES array is already present and correct.
- `AccountCenter`: two `useEffect` fetches but no `loading` guard; the component renders immediately with empty fields.

---

### A3 — BlocksCenter / GET block-list Endpoint

**Status**: **Already implemented in prior session.**
- `GET /api/engagement/block-list` endpoint exists in `engagement.js` (line 851).
- `BlocksCenter` component with loading state, avatar/name/@username display, and Unblock button exists in `Settings.jsx` (line 819).
- Response shape: `{ success, blocks: [{id, username, name, profile_pic, created_at}] }`.

No code change required.

---

### A4 — MutesCenter / mute endpoints

**Status**: **Already implemented in prior session.**
- `GET /api/engagement/mute-list` exists in `engagement.js` (line 918).
- `POST /api/engagement/mute/:creatorId` toggle exists (line 877).
- `MutesCenter` component with loading state, Unmute button, exists in `Settings.jsx` (line 878).
- Response shape: `{ success, mutes: [{id, username, name, profile_pic, created_at}] }`.

No code change required.

---

### A5+A6 — DataPrivacyCenter: status on mount, cancel button, no spurious logout

**Status**: **Substantially implemented in prior session.** Current `DataPrivacyCenter` (line 707):
- Fetches `/data/deletion/status` on mount; reads `res.pending` / `res.scheduledFor`.
- Shows pending-deletion panel with Cancel button when `isPending === true`.
- `scheduleDeletion`: on `!res.success` it calls `showToast(res.error)` — it does **not** call `logout()` on failure. The spurious logout bug is already fixed.
- `cancelDeletion`: calls `POST /data/deletion/cancel`, resets state on success.

**Remaining gap — `scheduleDeletion` success path**: The current code sets `isPending(true)` and then immediately calls `logout()` on success. Per requirement 2.6/2.7, the success path **should** toast and then logout after 2-second delay. The existing code does call `logout()` but without the delay. This is a minor timing fix.

**Bug Condition for the remaining gap:**
```
FUNCTION isBugCondition_A6(action)
  INPUT: action — scheduleDeletion call result
  OUTPUT: boolean

  RETURN action.httpStatus = 200  (success)
     AND action.logoutDelayMs < 2000  (logout fires instantly, not after 2s toast read time)
END FUNCTION
```

---

### A9 — GET /api/data/deletion/status Endpoint

**Status**: **Already implemented.** Endpoint exists in `data.js` (line 165), returns `{ success, pending, scheduledFor }`. No code change required.

---

### B1 — Spurious /login Redirect

**Bug Condition:**
```
FUNCTION isBugCondition_B1(refreshError)
  INPUT: refreshError — error thrown by user.getIdToken(true)
  OUTPUT: boolean

  RETURN refreshError.code != 'auth/network-request-failed'
     AND auth.currentUser IS NOT NULL  -- user has a valid Firebase session
     AND window.location redirects to '/login'
END FUNCTION
```

**Examples:**
- App starts, a background API call fires before Firebase SDK fully initialises → 401 → refresh throws `auth/user-token-expired` transiently → redirect to /login despite user being logged in.
- Firebase throws `auth/too-many-requests` during a brief quota window → redirect to /login despite valid session.

**Current behavior**: The existing code (lines 80–96 of `apiInterceptor.js`) already handles `auth/network-request-failed` specially (throws instead of redirecting). But for all other non-network refresh errors, it unconditionally redirects even if `auth.currentUser` is non-null.

---

### B2 — Concurrent 401 Refresh Deduplication

**Bug Condition:**
```
FUNCTION isBugCondition_B2(requests)
  INPUT: requests — set of concurrent API calls that all receive 401 simultaneously
  OUTPUT: boolean

  RETURN |{r IN requests : r.calls_getIdToken_true}| > 1
END FUNCTION
```

**Examples:**
- Page loads and fires 4 simultaneous API calls (feed, notifications, profile, settings) → all 401 → 4 parallel `getIdToken(true)` calls → Firebase quota exhaustion risk.

**Current behavior**: No `refreshPromise` deduplication exists. Each 401 path calls `user.getIdToken(true)` independently.

---

### C1 — ProfileContentViewer `forceAdd` Argument

**Bug Condition:**
```
FUNCTION isBugCondition_C1(call)
  INPUT: call — invocation of handleRespect(postId, forceAdd) inside ProfileContentViewer
  OUTPUT: boolean

  RETURN call.passesForceAdd = true
     AND giveRespect.signature = (videoId, forceAdd = false)  -- forceAdd is a valid param
     AND call.source = 'ReelCard onRespect callback passing forceAdd implicitly'
END FUNCTION
```

**Current behavior**: `handleRespect = (postId, forceAdd) => giveRespect(postId, forceAdd)`. Since `giveRespect` accepts `forceAdd` as its second parameter, the call doesn't crash — but the design intent is that `ProfileContentViewer` should never force-add respects; it should let `giveRespect` toggle normally. Passing `forceAdd` from a callback that originated in a `ReelCard` interaction (where `forceAdd` may be `undefined` or a synthetic event) creates an inconsistency.

**Fix**: Drop `forceAdd` from `handleRespect`'s signature so it always calls `giveRespect(postId)`.

---

### C2 — ShareModal Premature Share Count

**Bug Condition:**
```
FUNCTION isBugCondition_C2(event, location)
  INPUT: event — user interaction with Reels share UI
         location — call site of incrementShare
  OUTPUT: boolean

  RETURN location = 'handleShare_top'  -- incrementShare called before platform action
     AND (event.type = 'modal_open' OR event.type = 'sheet_displayed')
     AND event.shareCompleted = false
END FUNCTION
```

**Examples:**
- User taps Share icon on a reel → `handleShare` starts → `incrementShare(postId)` is called immediately at line 410 **before** any platform window opens.
- User taps "More" (native share) → share sheet appears → user cancels → share count already incremented.

**Scope**: This bug exists in `Reels.jsx`'s `handleShare` function. `ProfileContentViewer.jsx` already uses `onShareComplete` correctly — the count is only incremented when clipboard copy succeeds or a platform link is tapped.

Note: `ShareModal` component itself is **not** the fix target here; it already calls `onShareComplete` only on completion. The bug is in the **inline Reels share sheet** which directly calls `handleShare` and increments before the action completes.

---

### D1 — Per-Route Error Boundaries

**Bug Condition:**
```
FUNCTION isBugCondition_D1(importResult)
  INPUT: importResult — result of a lazy() import for a route module
  OUTPUT: boolean

  RETURN importResult.status = 'failed'
     AND noPerRouteErrorBoundary = true
     AND appCrashedToBlankScreen = true
END FUNCTION
```

**Current behavior**: `AppRoutes.jsx` wraps all routes in a single `<Suspense>`. If any lazy import fails, React throws during render and the entire app goes blank because there is no error boundary to contain it.

---

### D2 — Reels `postId` Deep Link

**Bug Condition:**
```
FUNCTION isBugCondition_D2(url)
  INPUT: url — URL navigated to by the user
  OUTPUT: boolean

  RETURN url.searchParams.has('postId') = true
     AND (
       postNotFoundInFeed = true AND noToastShown = true
       OR searchParamNotCleared = true
     )
END FUNCTION
```

**Current behavior**: `Reels.jsx` already reads `targetPostId = searchParams.get('postId')` and attempts `setCur(idx >= 0 ? idx : 0)` when feed loads. However:
1. If `idx < 0` (post not in feed), it silently falls back to index 0 with no toast.
2. The `postId` query param is never cleared from the URL after the jump.
3. The deep-link jump only fires during the `processAndSetFeed` callback — if the feed loads before the component is ready to handle the param, the scroll might be missed.

---

## Expected Behavior

### Preservation Requirements

**Unchanged behaviors — these must not regress:**

- `apiCall` 2xx success path: callers receive `res.json()` result as before (req. 3.1).
- All 8 notification toggle keys are stored and retrieved correctly when all are explicit booleans (req. 3.2).
- `POST /api/engagement/block/:creatorId` behavior is unchanged; only the read-side block-list endpoint is added (req. 3.3).
- `safetyFilter.js` reads from `user_mutes` table unaffected; mute endpoints use the same table with no schema changes (req. 3.4).
- First-time account deletion (no existing `PENDING` row) creates the deletion request as before (req. 3.5).
- Successful `DataPrivacyCenter` deletion request shows toast and logs out as before, only with the 2-second delay added (req. 3.6).
- Non-401 authenticated requests pass through the interceptor untouched (req. 3.7).
- Single 401 with successful token refresh retries the original request as before (req. 3.8).
- `giveRespect` callers outside `ProfileContentViewer` are unaffected (req. 3.9).
- Closing `ShareModal` or the Reels share sheet without sharing leaves share count unchanged (req. 3.10).
- All lazy route imports that succeed render as before (req. 3.11).
- Reels page without `?postId` param loads the normal feed at index 0 (req. 3.12).
- Protected files (`feedRanker.js`, `feedExperiment.js`, `rankingEngine.js`, `engagementVelocity.js`, `middleware/auth.js`, `config/firebase.js`) are not touched (req. 3.13).
- All existing API endpoint response shapes are backward-compatible (req. 3.14).
- All SQL is idempotent and non-destructive (req. 3.15).

---

## Hypothesized Root Causes

1. **A2/A7 — Missing loading state**: The settings sub-components were written without a loading guard, relying on empty initial state to be benign. For toggles this causes a visible flicker of all toggles in the "off" state on mount.

2. **A6 — Instant logout on deletion**: The `scheduleDeletion` success handler calls `logout()` synchronously, giving the user no time to read the toast confirmation before being redirected.

3. **B1 — Unconditional redirect after non-network refresh failure**: The interceptor correctly skips the redirect for `auth/network-request-failed` but misses the broader case: any non-null `auth.currentUser` means the session is still alive, so the redirect is incorrect regardless of the error type.

4. **B2 — No deduplication of concurrent refreshes**: The interceptor was written without considering concurrent request scenarios; each 401 handler is independent with no shared state.

5. **C1 — `forceAdd` leaks from `ReelCard` callback signature**: `handleRespect` mirrors the prop signature it receives from `ReelCard` (which calls `onRespect(postId, forceAdd)`), propagating `forceAdd` unintentionally to `giveRespect`.

6. **C2 — `incrementShare` placed before platform action in Reels**: The share handler in `Reels.jsx` was written in a sequential style and `incrementShare` was placed at the top for simplicity, without considering that the async platform action (navigator.share, clipboard write) can be cancelled.

7. **D1 — Single Suspense without error boundaries**: Error boundaries were omitted from the route configuration; the existing `Suspense` handles loading but not module-load failures.

8. **D2 — Incomplete deep-link handling**: `postId` jumping was partially implemented (the `setCur` call exists) but the not-found toast and URL cleanup were not added.

---

## Correctness Properties

Property 1: Loading State — Settings Centers Show Spinner

_For any_ mount of `NotificationsCenter` or `AccountCenter` where the initial data fetch has not yet resolved, the component SHALL display a loading indicator and SHALL NOT render interactive elements with stale empty state.

**Validates: Requirements 2.10**

Property 2: Auth Interceptor — No Redirect with Live Session

_For any_ token refresh failure where `auth.currentUser` is non-null after the failure, the interceptor SHALL NOT redirect to `/login`; it SHALL throw the error so the original caller can handle it.

**Validates: Requirements 2.11**

Property 3: Auth Interceptor — Single Refresh Promise

_For any_ set of N concurrent requests that all receive a 401, the interceptor SHALL call `getIdToken(true)` exactly once, with all N waiters awaiting the same promise.

**Validates: Requirements 2.12**

Property 4: Respect Action — No forceAdd Propagation

_For any_ respect action initiated from `ProfileContentViewer`, the call to `giveRespect` SHALL receive exactly one argument (the `postId`), so the natural toggle behavior of `giveRespect` is preserved.

**Validates: Requirements 2.13**

Property 5: Share Count — Increment Only on Completion

_For any_ share interaction in `Reels.jsx`, `incrementShare` SHALL be called only after the platform action completes (clipboard write succeeds or destination link is opened), and SHALL NOT be called when the share sheet is dismissed without action.

**Validates: Requirements 2.14**

Property 6: Route Error Isolation

_For any_ lazy route import that throws, the ErrorBoundary wrapping that route SHALL catch the error and render a fallback UI, leaving all other routes functional and the top-level app mounted.

**Validates: Requirements 2.15**

Property 7: Deletion Success — 2-Second Logout Delay

_For any_ successful `scheduleDeletion` call, the system SHALL show a toast, then call `logout()` after a 2-second delay, not immediately.

**Validates: Requirements 2.6 (partial timing fix)**

Property 8: Reels Deep Link — Post Not Found Handling

_For any_ navigation to `/reels?postId=X` where post X is not present in the loaded feed, the system SHALL show a brief "Post not found" toast and clear the `postId` query param from the URL.

**Validates: Requirements 2.16**

---

## Fix Implementation

### Changes Required

#### File: `backend/frontend/src/pages/Settings.jsx`

**A2 — NotificationsCenter loading state** (minimal diff):

Add `loading` state initialized to `true`; set it to `false` when the fetch settles; render a loading indicator before the toggle list.

```javascript
// Before useEffect:
const [loading, setLoading] = useState(true);

// In useEffect:
apiCall('/settings/notifications').then(res => {
  if (res.success) setNotifs(res.notifications || {});
  setLoading(false);
}).catch(() => setLoading(false));

// At top of return:
if (loading) return <div style={{color: '#888', padding: 16}}>Loading...</div>;
```

**A7 — AccountCenter loading state** (minimal diff):

Add a single `loading` state; set to `false` when both fetches (profile + providers) have settled using `Promise.all`.

```javascript
const [loading, setLoading] = useState(true);

// Replace two separate .then chains with:
Promise.all([
  apiCall('/settings/profile'),
  apiCall('/settings/providers'),
]).then(([profileRes, providersRes]) => {
  if (profileRes.success) setProfile(profileRes.profile);
  if (providersRes.success) setProviders(providersRes.providers);
  setLoading(false);
}).catch(() => setLoading(false));

// At top of return:
if (loading) return <div style={{color: '#888', padding: 16}}>Loading...</div>;
```

**A6 — scheduleDeletion 2-second delay before logout**:

```javascript
// Change:
if (res.success) {
  setIsPending(true);
  showToast("Account scheduled for deletion (30-day grace period)");
  if (typeof logout === 'function') {
    logout();  // <-- immediate
  }
}

// To:
if (res.success) {
  setIsPending(true);
  showToast("Account scheduled for deletion (30-day grace period)");
  if (typeof logout === 'function') {
    setTimeout(logout, 2000);  // <-- 2s delay
  }
}
```

---

#### File: `backend/frontend/src/apiInterceptor.js`

**B1 — Check `auth.currentUser` before redirecting** (minimal diff — 3-line change):

```javascript
// Current (in catch refreshError block, after network error check):
if (window.location.pathname !== '/login') {
  window.location.href = '/login';
}
throw new Error('Authentication invalid or expired');

// Fixed:
// Only redirect when Firebase session is truly gone
if (!auth.currentUser) {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  throw new Error('Authentication invalid or expired');
}
// auth.currentUser is non-null — session is live, just fail the request
throw refreshError;
```

**B2 — Concurrent 401 deduplication** (add module-level variable + share the promise):

```javascript
// Add at module level (after `const originalFetch = window.fetch`):
let refreshPromise = null;

// In the 401 handler, replace `user.getIdToken(true)` with:
if (!refreshPromise) {
  refreshPromise = user.getIdToken(true).finally(() => {
    refreshPromise = null;
  });
}
const freshToken = await refreshPromise;
```

The rest of the retry logic (attach header, retry originalFetch) remains unchanged.

---

#### File: `backend/frontend/src/components/profile/ProfileContentViewer.jsx`

**C1 — Remove `forceAdd` from handleRespect** (1-line change):

```javascript
// Before:
const handleRespect = useCallback((postId, forceAdd) => {
  if (giveRespect) giveRespect(postId, forceAdd);
}, [giveRespect]);

// After:
const handleRespect = useCallback((postId) => {
  if (giveRespect) giveRespect(postId);
}, [giveRespect]);
```

---

#### File: `backend/frontend/src/pages/Reels.jsx`

**C2 — Move `incrementShare` to completion handlers**:

The `handleShare` function currently calls `incrementShare(postId)` unconditionally at the top. The fix moves it to only fire after a confirmed platform action:

```javascript
const handleShare = async (platform, postId) => {
  const deepLink = `https://drandee.app/reel/${postId}`;
  const shareText = "Check out this reel on Drandee!";
  // REMOVED: incrementShare && incrementShare(postId);  ← was here

  if (platform === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + deepLink)}`, "_blank");
    incrementShare && incrementShare(postId);  // ← moved here, after opening
  } else if (platform === "telegram") {
    window.open(/* ... */);
    incrementShare && incrementShare(postId);
  } else if (platform === "twitter") {
    window.open(/* ... */);
    incrementShare && incrementShare(postId);
  } else if (platform === "more" || platform === "copy") {
    // existing try/catch block
    // call incrementShare only on success:
    try {
      if (navigator.share) {
        await navigator.share({ ... });
        incrementShare && incrementShare(postId);  // ← after confirmed share
      } else {
        await navigator.clipboard.writeText(deepLink);
        incrementShare && incrementShare(postId);  // ← after confirmed copy
        // ... existing setCopied logic
      }
    } catch (error) {
      // user cancelled — do NOT call incrementShare
    }
  }
};
```

**D2 — postId deep-link completion** (add toast + param clearing):

`Reels.jsx` already reads `targetPostId` and calls `setCur(idx >= 0 ? idx : 0)`. The remaining additions:

```javascript
// Need useSearchParams setter (destructure both):
const [searchParams, setSearchParams] = useSearchParams();

// In processAndSetFeed, after setCur call:
if (targetPostId) {
  const idx = filteredFeed.findIndex(p => String(p.id) === String(targetPostId));
  setCur(idx >= 0 ? idx : 0);
  if (idx < 0) {
    showToast("Post not found");  // use existing toast mechanism
  }
  // Clear the param so back-navigation doesn't re-trigger
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.delete('postId');
    return next;
  }, { replace: true });
}
```

Note: `Reels.jsx` doesn't currently use a toast function. The existing `feedbackMsg` pattern or a local state-based inline toast (mirroring the Settings `Toast` component) can be used. The simplest approach is a local `feedbackMsg` entry: `setFeedbackMsg(prev => ({ ...prev, __deeplink__: 'notFound' }))` with a matching render, or a dedicated `toastMsg` state. The exact mechanism is left to implementation but must not import from Settings.

---

#### File: `backend/frontend/src/routes/AppRoutes.jsx`

**D1 — Per-route ErrorBoundary** (~15-line class component + wrap each Route element):

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white gap-4">
          <p>This page failed to load.</p>
          <a href="/" className="text-indigo-400 underline">Go to home</a>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Each `<Route element={<ProtectedRoute><LazyPage /></ProtectedRoute>}>` becomes:

```jsx
<Route element={
  <ErrorBoundary>
    <ProtectedRoute><LazyPage /></ProtectedRoute>
  </ErrorBoundary>
} />
```

The outer `<Suspense>` remains in place for the loading fallback. The `ErrorBoundary` sits inside `Suspense` so that loading and error states are independent.

---

#### File: `backend/migrations/add_user_prefs_columns.sql` (new file — do not execute)

```sql
-- Idempotent: adds columns referenced by GET/PUT /api/settings/preferences
-- Safe to run multiple times; no destructive operations.
ALTER TABLE users ADD COLUMN IF NOT EXISTS autoplay_videos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_saver_mode BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## Testing Strategy

### Validation Approach

Two-phase: first run exploratory tests against unfixed code to confirm root cause, then run fix-checking and preservation tests on the fixed code. Property-based tests cover the preservation domain for the interceptor and engagement actions.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug on unfixed code, confirm root cause hypotheses.

**Test Cases:**

1. **A2 Loading Flash** (visual, manual): Open NotificationsCenter in DevTools with network throttled to "Slow 3G" — all toggles render as `off` for ~500ms before snapping to real values. Expected counterexample: toggle states flicker on mount.

2. **B1 Spurious Redirect** (unit): Mock `auth.currentUser = { uid: 'x' }` (non-null), mock `getIdToken(true)` to throw `{ code: 'auth/too-many-requests' }`. Invoke the 401 handler. Unfixed code: `window.location.href` is set to `/login`. Fixed code: `window.location.href` is NOT set.

3. **B2 Concurrent Refresh** (unit): Simulate 4 simultaneous `fetch` calls all returning 401. Count calls to `user.getIdToken(true)`. Unfixed: 4 calls. Fixed: 1 call.

4. **C1 forceAdd Leakage** (unit): Call `handleRespect('123', true)`. Check argument passed to `giveRespect`. Unfixed: `giveRespect('123', true)`. Fixed: `giveRespect('123')`.

5. **C2 Premature incrementShare** (unit): Call `handleShare('whatsapp', '42')`. Check when `incrementShare` is called relative to `window.open`. Unfixed: `incrementShare` called before `window.open`. Fixed: `incrementShare` called after `window.open`.

6. **D1 Route Crash** (integration): Force a lazy import to reject (e.g., mock `import('../pages/Home')` to throw). Without ErrorBoundary: blank screen, React error boundary missing. With ErrorBoundary: "This page failed to load" message, other routes still render.

7. **D2 Missing Toast** (unit): Render Reels with `?postId=999999` (nonexistent). After feed loads: unfixed code falls back to index 0 with no toast, param remains in URL. Fixed: toast shown, param cleared.

**Expected counterexamples:**
- Toggles render `false` before data loads (A2).
- Redirect fires despite valid session (B1).
- `getIdToken(true)` called N times for N concurrent 401s (B2).
- `forceAdd` propagates to UserContext (C1).
- Share count increments before user acts (C2).

---

### Fix Checking

**Goal**: For all inputs where C(X) is true, verify F'(X) satisfies P(result).

```
FOR ALL component WHERE isBugCondition_A2(component) DO
  result := render(component)
  ASSERT result.showsSpinner UNTIL fetchResolves
  ASSERT result.doesNotRenderStaleToggles
END FOR

FOR ALL refreshError WHERE isBugCondition_B1(refreshError) DO
  result := interceptor401Handler(refreshError)
  ASSERT window.location.href != '/login'
  ASSERT result.throws(refreshError)
END FOR

FOR ALL requestSet WHERE isBugCondition_B2(requestSet) DO
  result := interceptorHandles(requestSet)
  ASSERT countOf(getIdToken_true_calls) = 1
END FOR

FOR ALL call WHERE isBugCondition_C1(call) DO
  ASSERT giveRespect.argsCount = 1
  ASSERT giveRespect.args[0] = call.postId
END FOR

FOR ALL event WHERE isBugCondition_C2(event) DO
  result := handleShare(event.platform, event.postId)
  ASSERT incrementShare.callTime >= platformAction.completionTime
END FOR

FOR ALL importFailure WHERE isBugCondition_D1(importFailure) DO
  ASSERT routeShowsFallbackUI
  ASSERT otherRoutes.stillRenderable
END FOR
```

---

### Preservation Checking

**Goal**: For ¬C(X) inputs, assert F'(X) = F(X).

```
FOR ALL call WHERE apiCall.status = 2xx DO
  ASSERT F'(call) = F(call)  -- 2xx path unchanged
END FOR

FOR ALL refresh WHERE auth.currentUser IS NULL AND refresh.throws DO
  ASSERT F'(refresh).redirectsTo('/login') = F(refresh).redirectsTo('/login')  -- null session still redirects
END FOR

FOR ALL singleRequest WHERE request.gets401 AND token.refreshSucceeds DO
  ASSERT F'(singleRequest) retries with freshToken  -- single-401 retry path unchanged
END FOR

FOR ALL share WHERE share.action = 'completed' DO
  ASSERT F'(share).incrementsShareCount  -- completed shares still counted
END FOR

FOR ALL route WHERE import.succeeds DO
  ASSERT F'(route).rendersIdentically  -- successful routes unchanged
END FOR

FOR ALL reels WHERE url.hasNoPostId DO
  ASSERT F'(reels).loadsFeedAtIndex0  -- no-param path unchanged
END FOR
```

**Testing Approach**: Property-based testing is particularly valuable for B2 (concurrent request deduplication) — generating random N (1–20) concurrent 401s and asserting exactly 1 `getIdToken` call every time provides strong guarantees across the concurrency domain.

---

### Unit Tests

- `Settings.jsx` — `NotificationsCenter`: render with mocked fetch delay; assert spinner present before resolve, toggles absent before resolve, all 8 toggles present after resolve.
- `Settings.jsx` — `AccountCenter`: same pattern for loading guard.
- `Settings.jsx` — `DataPrivacyCenter`: assert `scheduleDeletion` success calls `logout` after ≥2000ms, not before.
- `apiInterceptor.js` — B1: mock `auth.currentUser` non-null, refresh throws non-network error → no redirect, throws error.
- `apiInterceptor.js` — B1: mock `auth.currentUser` null, refresh throws → redirect fires.
- `apiInterceptor.js` — B2: 4 concurrent 401s → `getIdToken(true)` called once.
- `ProfileContentViewer.jsx` — C1: `handleRespect('id')` → `giveRespect` called with 1 arg only.
- `Reels.jsx` — C2: `handleShare('whatsapp', 'id')` → `incrementShare` call is after `window.open` call.
- `Reels.jsx` — D2: feed loads with no matching postId → feedbackMsg or toast state set.

---

### Property-Based Tests

- **B2 Concurrency**: Generate `n` in [1..20] concurrent 401 responses; assert exactly 1 `getIdToken(true)` call for all `n`.
- **C2 Share Preservation**: Generate random platform values in `{'whatsapp','telegram','twitter'}` with mocked `window.open`; assert `incrementShare` always fires exactly once per call, after `window.open`.
- **D1 Route Isolation**: Randomly fail 1 of N lazy imports; assert remaining N-1 routes render without error.

---

### Integration Tests

- Load Settings page with real (mocked) API delay; verify NotificationsCenter and AccountCenter show spinner then correct data.
- Load `/reels?postId=123` with a feed that includes post 123; verify `cur` is set to correct index and param is cleared.
- Load `/reels?postId=999` with a feed that does not include post 999; verify toast appears and param is cleared.
- Simulate page load that fires 3 parallel API calls all receiving 401; verify token is refreshed once and all 3 calls complete successfully.
