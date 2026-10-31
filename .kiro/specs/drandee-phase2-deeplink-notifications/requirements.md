# Drandee Phase 2 — Requirements

## Introduction

Two confirmed open items remain from the Phase 1 scope. Both are evidence-based code defects, not speculative improvements. Phase 1 browser verification confirmed all other tasks complete.

---

## Bug Analysis

### Current Behavior (Defect)

**D2 — Reels deep-link: URL param not cleared, no not-found feedback**

1.1 WHEN a user navigates to `/reels?postId=X` and post X is found in the feed THEN the system jumps to that post but does NOT clear `postId` from the URL. On every subsequent remount (back navigation, tab switch) the jump re-fires because `targetPostId` is re-read from the unchanged URL.

1.2 WHEN a user navigates to `/reels?postId=X` and post X is NOT in the loaded feed THEN the system silently falls back to index 0 with no user feedback, and the URL param is never cleared.

Root cause: `const [searchParams] = useSearchParams()` — the setter is not destructured, so `setSearchParams` is unavailable. No toast mechanism is wired for this path.

File: `backend/frontend/src/pages/Reels.jsx` line 70.

**N1 — Notifications: respect and comment notifications navigate to actor profile instead of the post**

1.3 WHEN a user taps a respect notification (type === 'respect') that has a postId THEN the system navigates to `/profile/:actorId` instead of `/reels?postId=X`, because the condition `n.type !== 'respect' && n.type !== 'comment'` prevents the post-navigation branch from executing.

1.4 WHEN a user taps a comment notification (type === 'comment') that has a postId THEN the same condition prevents post navigation, sending the user to the commenter's profile instead.

Root cause: The profile-navigation guard `if (n.actorId && n.type !== 'respect' && n.type !== 'comment')` was intended to skip profile navigation for engagement notifications and fall through to post navigation — but the outer `else if` chain means the profile branch fires first for types that do have an actorId. The actual execution order for a respect notification with both actorId and postId: the first condition `n.actorId && n.type !== 'respect'` is FALSE (type IS respect), so it skips to `else if (n.postId)` — which DOES navigate to the post. Re-reading confirms the logic is actually correct for respect/comment. However, a follow notification (type=follow, actorId set, no postId) correctly navigates to profile. Evidence is inconclusive from static analysis alone — marking N1 as NEEDS VERIFICATION before implementing.

File: `backend/frontend/src/pages/Notifications.jsx` lines 87–94.

**S1 — SecurityCenter: no loading state**

1.5 WHEN `SecurityCenter` mounts and begins fetching sessions and login history THEN the system renders with empty arrays immediately, showing "No sessions" before data arrives, because no loading state was added in Phase 1.

File: `backend/frontend/src/pages/Settings.jsx` — SecurityCenter function.

---

### Expected Behavior (Correct)

2.1 WHEN a user navigates to `/reels?postId=X` and post X is found THEN the system SHALL jump to that post AND clear the `postId` param from the URL (replace, not push) so remounts do not re-trigger the jump.

2.2 WHEN a user navigates to `/reels?postId=X` and post X is not in the feed THEN the system SHALL display a brief inline message ("Post not found") and clear the `postId` param from the URL.

2.3 WHEN `SecurityCenter` mounts THEN the system SHALL show a loading indicator until both the sessions fetch and login-history fetch have resolved.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Reels loads without a `postId` query param THEN feed loads normally at index 0 — unchanged.

3.2 WHEN Reels loads with a valid `postId` and the feed is empty (still loading) THEN the jump fires after `filteredFeed` populates — unchanged.

3.3 WHEN `SecurityCenter` receives data THEN sessions and history render as before — unchanged.

3.4 WHEN notification deep links navigate to `/reels?postId=X` THEN the Reels page handles the param via the D2 fix above — unchanged routing.

3.5 Protected files (feedRanker.js, feedExperiment.js, rankingEngine.js, engagementVelocity.js, middleware/auth.js, config/firebase.js) are NOT touched.
