# Tasks

## Task 1: Reels deep-link — add setSearchParams, clear URL param, show not-found feedback

**File:** `backend/frontend/src/pages/Reels.jsx`

### 1a — Destructure the setter from useSearchParams

Find line 70:
```js
const [searchParams] = useSearchParams();
```
Change to:
```js
const [searchParams, setSearchParams] = useSearchParams();
```

### 1b — After the setCur call in the filteredFeed effect, clear the param and show feedback

Find the `if (targetPostId)` block inside the `useEffect(() => { ... }, [filteredFeed])`. It currently reads:
```js
if (targetPostId) {
  // Try to find the post index and jump directly to it
  const idx = filteredFeed.findIndex(p => String(p.id) === String(targetPostId));
  setCur(idx >= 0 ? idx : 0);
}
```

Replace with:
```js
if (targetPostId) {
  // Try to find the post index and jump directly to it
  const idx = filteredFeed.findIndex(p => String(p.id) === String(targetPostId));
  setCur(idx >= 0 ? idx : 0);
  if (idx < 0) {
    // Post not in feed — show brief inline feedback
    setFeedbackMsg(prev => ({ ...prev, __deeplink__: 'notFound' }));
    setTimeout(() => setFeedbackMsg(prev => {
      const n = { ...prev };
      delete n.__deeplink__;
      return n;
    }), 3000);
  }
  // Clear param whether found or not — prevents re-jump on remount
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.delete('postId');
    return next;
  }, { replace: true });
}
```

### 1c — Render the not-found overlay

Inside the `reels-viewport` div, find the section where `feedbackMsg` overlays are rendered per-post. Add a sibling overlay for the `__deeplink__` key. Find the `feed.map(...)` block and add immediately BEFORE it (inside the final else branch that renders the feed map):

```jsx
{feedbackMsg.__deeplink__ === 'notFound' && (
  <div style={{
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(0,0,0,0.75)', color: '#fff',
    padding: '12px 20px', borderRadius: 8,
    fontSize: 14, fontWeight: 600,
    zIndex: 200, pointerEvents: 'none',
    animation: 'fadeIn 0.2s'
  }}>
    Post not found
  </div>
)}
```

**Acceptance criteria:**
- After navigating to `/reels?postId=X` (valid post), URL becomes `/reels` (param cleared), post is active.
- After navigating to `/reels?postId=999999` (invalid), URL becomes `/reels`, "Post not found" overlay appears briefly.
- Navigating to `/reels` with no param loads normally — no change in behavior.

---

## Task 2: SecurityCenter — add loading state

**File:** `backend/frontend/src/pages/Settings.jsx`

In the `SecurityCenter` function:

1. Add `const [loading, setLoading] = useState(true);` after the existing useState declarations.

2. Replace the two separate useEffect fetch calls:
```js
  useEffect(() => {
    apiCall('/security/sessions').then(res => res.success && setSessions(res.sessions));
    apiCall('/security/login-history').then(res => res.success && setHistory(res.history));
  }, []);
```
With a parallel Promise.all:
```js
  useEffect(() => {
    Promise.all([
      apiCall('/security/sessions'),
      apiCall('/security/login-history'),
    ]).then(([sessRes, histRes]) => {
      if (sessRes.success) setSessions(sessRes.sessions || []);
      if (histRes.success) setHistory(histRes.history || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
```

3. Add a loading guard as the first statement in the return block:
```js
  if (loading) return <div style={{color: '#888', padding: 16}}>Loading…</div>;
```

**Acceptance criteria:**
- SecurityCenter shows "Loading…" immediately on mount.
- After both fetches resolve, shows sessions and history as before.
- No other SecurityCenter behavior changes.

---

## Task 3: Run frontend build and verify

Run: `cd backend/frontend && npm run build`

- Build must exit 0.
- No new errors.
- Confirm protected files unchanged: `git diff -- backend/utils/feedRanker.js backend/utils/feedExperiment.js backend/utils/rankingEngine.js backend/utils/engagementVelocity.js backend/middleware/auth.js`
