# Drandee Phase 2 — Design

## Overview

Three targeted fixes across two files. No new endpoints, no schema changes, no protected files touched.

---

## Fix D2 — Reels deep-link: add setSearchParams + not-found feedback

**File:** `backend/frontend/src/pages/Reels.jsx`

**Current code (line 70):**
```js
const [searchParams] = useSearchParams();
const targetPostId = searchParams.get('postId');
```

**Change 1:** Destructure the setter:
```js
const [searchParams, setSearchParams] = useSearchParams();
const targetPostId = searchParams.get('postId');
```

**Current code (lines ~186–194) in the filteredFeed effect:**
```js
if (targetPostId) {
  const idx = filteredFeed.findIndex(p => String(p.id) === String(targetPostId));
  setCur(idx >= 0 ? idx : 0);
}
```

**Change 2:** After setCur, clear the param and show not-found feedback:
```js
if (targetPostId) {
  const idx = filteredFeed.findIndex(p => String(p.id) === String(targetPostId));
  setCur(idx >= 0 ? idx : 0);
  if (idx < 0) {
    // Show brief not-found feedback using existing feedbackMsg pattern
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

**Change 3:** Render the not-found message. Add near the feedError/feed.length === 0 display (inside the reels-viewport, outside the feed.map):
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

Note: `feedbackMsg` is already a `{[postId]: string}` map in Reels state. Using `__deeplink__` as the key avoids collision with real post IDs.

---

## Fix S1 — SecurityCenter loading state

**File:** `backend/frontend/src/pages/Settings.jsx`

**Current SecurityCenter:**
```js
function SecurityCenter({ showToast }) {
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    apiCall('/security/sessions').then(res => res.success && setSessions(res.sessions));
    apiCall('/security/login-history').then(res => res.success && setHistory(res.history));
  }, []);
```

**Change:** Add loading state, parallel fetch, loading guard:
```js
function SecurityCenter({ showToast }) {
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Add at top of return:
  if (loading) return <div style={{color: '#888', padding: 16}}>Loading…</div>;
```

---

## N1 — Notification tap routing

Static analysis was inconclusive. The condition chain in Notifications.jsx handleTap is:
```js
if (n.actorId && n.type !== 'respect' && n.type !== 'comment') {
  navigate(`/profile/${n.actorId}`);
} else if (n.postId) {
  navigate(`/reels?postId=${n.postId}`);
} else if (n.actorId) {
  navigate(`/profile/${n.actorId}`);
}
```

For a respect notification (type=respect, actorId set, postId set):
- First branch: `n.actorId && type !== 'respect'` → FALSE (type IS respect) → skips
- Second branch: `n.postId` → TRUE → navigates to `/reels?postId=X` ✅

For a follow notification (type=follow, actorId set, postId null):
- First branch: `n.actorId && type !== 'follow'`... wait — there is no exclusion for 'follow'. First branch fires → navigates to profile ✅

The logic is correct. N1 is NOT a bug — no fix needed. Marking resolved.

---

## Correctness Properties

Property 1 (D2 idempotence): For any navigation to `/reels?postId=X`, after the filteredFeed effect fires, the postId param SHALL be absent from the URL, regardless of whether the post was found.

Property 2 (D2 no-regression): For any Reels load without postId param, `setSearchParams` is never called and feed behavior is unchanged.

Property 3 (S1 loading): SecurityCenter SHALL not render session/history content until both fetches resolve.
