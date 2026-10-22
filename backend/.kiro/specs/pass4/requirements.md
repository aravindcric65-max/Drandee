# Requirements Document

## Introduction

Pass 4 addresses nine production bugs in the Drandee social app, plus a set of security hardening and performance improvements identified during code review. The bugs fall into two themes: broken engagement state (respect counts jumping +2, active color lost on refresh, engagement counts not displaying, cross-screen sync failures) and broken profile viewer UX (caption/tags missing, views count stuck at zero, 403 on the viewers endpoint, sheet actions not opening, and vertical swipe intercepted by inner scroll). Root causes were traced to a specific double-increment in `PostActions.jsx` + `UserContext`, missing propagation of the `has_respected` field from `formatPost` into `post.userInteraction`, and event-listener/prop-drilling gaps in `ProfileContentViewer`. All fixes must be minimal targeted diffs; no ranking logic, no auth middleware, no API contract changes, and no visual redesign.

---

## Hard Constraints

- **MUST NOT modify**: `feedRanker.js`, `feedExperiment.js`, `middleware/auth.js`, `rankingEngine.js`, `engagementVelocity.js`, `config/firebase.js`
- **MUST NOT change** the UI color palette: `#7F77DD`, `#080808`, `#1a1a1a`, `#252525`, existing Tailwind classes, or existing animations
- **MUST NOT change** any route path, HTTP method, or response contract unless a verified bug explicitly requires it
- Each fix MUST represent the smallest safe diff that resolves the root cause

---

## Requirements

### 1. Respect Count — Single Increment (Bug 1)

#### User Stories
- As a user, when I tap respect once, the count increases by exactly 1 and the icon turns colored.
- As a user, when I un-respect, the count decreases by exactly 1 and the icon reverts.
- As a user, rapid taps do not fire multiple requests or produce multiple count changes.

#### Acceptance Criteria
1. MUST: Tapping the respect button exactly once MUST result in the displayed count incrementing by exactly 1, with no intermediate flash to a higher value.
2. MUST NOT: The count MUST NOT increment twice in the same user interaction cycle, regardless of how many state update paths (local `PostActions` state, `UserContext` optimistic update, `engagement_updated` event) are active.
3. MUST: Un-tapping respect MUST result in the displayed count decrementing by exactly 1, with no intermediate flash to a lower value.
4. MUST: The final displayed count after server reconciliation MUST match the value returned by the server for that post.
5. MUST NOT: The `engagement_updated` event dispatched by `UserContext.giveRespect` MUST NOT cause a second visual increment after `PostActions` has already applied its own optimistic increment for the same interaction.
6. SHOULD: Rapid successive taps MUST NOT enqueue multiple in-flight requests; a debounce or in-flight guard MUST prevent this.
7. MUST NOT: React StrictMode double-invocation of effects MUST NOT cause an additional increment in development builds.

---

### 2. Respect Active State — Initial Load (Bug 2)

#### User Stories
- As a user, posts I have already respected MUST show the respect icon in its colored/active state when I open the feed or refresh the page.
- As a user, the correct active state MUST be visible before I interact with any post.

#### Acceptance Criteria
1. MUST: On initial feed load, the respect icon for a post MUST reflect the `has_respected` value returned by `formatPost` in `postModel.js` without requiring the user to interact with the post first.
2. MUST: `PostActions.jsx` MUST initialize `hasRespected` from the `has_respected` (or its camelCase equivalent `hasRespected`) field present in the API response, not solely from `post.userInteraction.hasRespected` which is unpopulated before any engagement event fires.
3. MUST: After a page refresh, a post the user previously respected MUST immediately render with the active respect color without waiting for a `engagement_updated` event.
4. MUST NOT: The active respect state for post A MUST NOT affect the displayed state of post B.
5. MUST: The active state source of truth on initial load MUST be consistent between the feed (Reels.jsx) and the profile viewer (`ProfileContentViewer`).
6. SHOULD: If `user.respectedVideos` in `UserContext` is used as a fallback, it MUST be populated from the feed API's `has_respected` field, not only from `localStorage` on init.

---

### 3. Engagement Counts Visible (Bug 3)

#### User Stories
- As a user, I can see the number of respects, comments, shares, and saves on a post when those counts are greater than zero.
- As a user, the view count on a post updates to reflect how many times it has been watched.

#### Acceptance Criteria
1. MUST: `PostActions.jsx` MUST correctly receive `stats.respects`, `stats.comments`, `stats.shares`, `stats.saves`, and `stats.views` populated by `formatPost` in `postModel.js`.
2. MUST: Any post returned by `GET /api/feed` that has `total_respects > 0` in the database MUST display a non-zero respect count in `PostActions`.
3. MUST: Any post returned by `GET /api/feed` that has `comment_count > 0` in the database MUST display a non-zero comment count in `PostActions`.
4. MUST: The `stats` object MUST flow through `FeedItem.jsx` → post component (VideoPost / PhotoPost) → `PostActions` without being dropped or overwritten with an empty object.
5. MUST: View counts (`watch_count` column → `stats.views` in `formatPost`) MUST be incremented when a user watches a post, and the incremented value MUST be visible in `PostActions` on subsequent loads.
6. MUST NOT: The `/api/home/impression` endpoint MUST NOT be the sole tracking path for view counts if it does not update `posts.watch_count`; a dedicated view-count increment path MUST exist and be called when a post is watched.

---

### 4. Cross-Screen Engagement Sync (Bug 4)

#### User Stories
- As a user, if I respect a post in the feed, that post's respect state MUST also appear active when I view the same post on my profile.
- As a user, engagement changes made in one screen MUST be reflected on other screens showing the same post within the same session.

#### Acceptance Criteria
1. MUST: A respect action taken in `Reels.jsx` (feed) MUST be reflected in `ProfileContentViewer` for the same post ID within the same app session.
2. MUST: A respect action taken in `ProfileContentViewer` MUST be reflected in `Reels.jsx` for the same post ID within the same app session.
3. MUST: The single source of truth for a post's engagement state after any user interaction MUST be consistent across `UserContext.posts`, `Reels.jsx` local trackers, and `PostActions.jsx` local state.
4. MUST NOT: The `engagement_updated` event MUST NOT be dispatched or consumed more than once per user action for a given post ID in a given screen.
5. MUST: When `ProfileContentViewer` receives an `engagement_updated` event for a post it is displaying, the `PostActions` component for that post MUST reflect the updated state without requiring a full page reload.
6. SHOULD: The event propagation chain from user action → `UserContext` → `engagement_updated` → consuming screens MUST NOT have any broken listener registrations that cause sync to silently fail.

---

### 5. Caption and Tags Display (Bug 5)

#### User Stories
- As a user, I can read the caption of a post in both the feed and on a profile.
- As a user, hashtags attached to a post are visible and tappable.

#### Acceptance Criteria
1. MUST: `PostInfo.jsx` MUST display the caption for any post where `post.caption`, `post.content.caption`, `post.text`, or `post.content.text` is non-empty.
2. MUST: Posts uploaded via the upload route, where text may be stored in `overlay_text` instead of `caption`, MUST have their caption visible via `post.content.text` (populated from `overlay_text` by `formatPost`).
3. MUST: `PostInfo.jsx` MUST display hashtags for any post where `post.tags`, `post.content.tags`, or `post.hashtags` is a non-empty array, as returned by `safeTags` in `postModel.js`.
4. MUST: Caption and tags returned by `formatPost` MUST NOT be stripped or overwritten by any post-ranking transformation before the data reaches the frontend.
5. MUST: The feed route (`GET /api/feed`) MUST call `formatPost` on each post before sending the response, ensuring `caption`, `content.caption`, `tags`, and `hashtags` are present on every post object the frontend receives.
6. MUST: The home feed route (`GET /api/home/feed`) MUST apply `formatPost` in a way that preserves `caption`, `tags`, `overlay_text`, and all content fields after any ranking transformation.

---

### 6. Views Count (Bug 6)

#### User Stories
- As a user, I can see how many times a post has been viewed.
- As a creator, my post's view count increases each time another user watches it.

#### Acceptance Criteria
1. MUST: When a user watches a post (video plays past the engagement threshold), a request MUST be made that increments `posts.watch_count` in the database for that post.
2. MUST NOT: The view increment path MUST NOT rely solely on `POST /api/home/impression` with `action: 'view'` if that endpoint only writes to `feed_impressions` and does not update `posts.watch_count`.
3. MUST: `formatPost` MUST map `row.watch_count` to `stats.views` so that the view count is available to `PostActions.jsx` as `stats.views`.
4. MUST: `PostActions.jsx` MUST display `stats.views` when it is greater than zero.
5. MUST: The view count displayed in the UI MUST match the `watch_count` value stored in the database for that post (subject to normal propagation delay).
6. SHOULD: The view tracking call MUST be deduplicated per session per post to avoid inflating counts from repeated plays of the same post in the same session.

---

### 7. Viewers Endpoint — Ownership and Error Handling (Bug 7)

#### User Stories
- As a creator, I can view the list of users who have watched my post without getting a 403 error.
- As a user, I cannot access the viewers list for a post I did not create.

#### Acceptance Criteria
1. MUST: `GET /api/engagement/viewers/:postId` MUST return the viewers list when the requesting user is the owner of the post, as determined by matching `posts.user_id` OR `posts.creator_id` against `req.auth.userId`.
2. MUST NOT: The ownership check in `engagement.js` MUST NOT fail when `posts.creator_id` is populated but `posts.user_id` is null or mismatched due to a Firebase UID vs. integer ID discrepancy.
3. MUST: A user who does not own the post MUST receive a `403` response with a generic, non-leaking error message.
4. MUST NOT: The viewers endpoint MUST NOT return internal error details (`err.message`) to the client in any response, including `500` error responses.
5. MUST: The frontend (Reels.jsx or any surface calling the viewers endpoint) MUST only invoke `GET /api/engagement/viewers/:postId` for posts owned by the currently authenticated user.
6. MUST: The `limit` query parameter on the viewers endpoint MUST be capped at a maximum value (e.g., 100) to prevent unbounded result sets.

---

### 8. ProfileContentViewer — Sheets and Actions (Bug 8)

#### User Stories
- As a user, tapping the comment button on a post in the profile viewer opens the comment sheet.
- As a user, tapping share, save, and more (⋯) on a post in the profile viewer opens the corresponding sheet or menu.

#### Acceptance Criteria
1. MUST: Tapping the comment action in `PostActions` while inside `ProfileContentViewer` MUST set `activeCommentPostId` and render the comment sheet for the correct post.
2. MUST: Tapping the share action MUST set `activeSharePostId` and render the share sheet for the correct post.
3. MUST: Tapping the save action MUST set `activeSavePostId` and render the save sheet for the correct post.
4. MUST: Tapping the more (⋯) action MUST set `activeMorePostId` and render the `MoreMenu` for the correct post.
5. MUST: All sheets and menus rendered by `ProfileContentViewer` MUST be positioned outside the inner scrollable card container so they are not clipped by `overflow-y-auto`.
6. MUST: The `onComment`, `onShare`, `onSave`, and `onMore` handlers passed from `ProfileContentViewer` into `FeedItem` MUST reach `PostActions` without being lost or overwritten at any point in the prop-drilling chain (`FeedItem` → VideoPost/PhotoPost → `PostActions`).
7. MUST: `ProfileContentViewer` MUST pass an `onViewsClick` handler (or equivalent) so that tapping the views icon does not silently fail.

---

### 9. ProfileContentViewer — Vertical Swipe Navigation (Bug 9)

#### User Stories
- As a user, I can swipe up or down in the profile content viewer to navigate between posts.
- As a user, swiping to navigate between posts does not accidentally scroll the content of the current post.

#### Acceptance Criteria
1. MUST: The profile content viewer MUST support swipe-up to advance to the next post and swipe-down to return to the previous post.
2. MUST NOT: A vertical swipe on the post card MUST NOT be captured by the inner card's `overflow-y-auto` scroll container when the user's intent is to navigate between posts.
3. MUST: The outer snap-scroll container (`overflow-y-scroll snap-y snap-mandatory`) MUST receive the scroll/swipe event for inter-post navigation.
4. MUST: `currentIndex` in `ProfileContentViewer` MUST update correctly after each swipe so that the active post is always in sync with the visible post.
5. SHOULD: Keyboard up/down arrow keys SHOULD trigger navigation between posts for accessibility.
6. MUST: The inner card scroll (for long captions or comments within a post card) MUST still work when a user explicitly scrolls within the card content area.

---

### 10. Security Hardening

#### Acceptance Criteria
1. MUST NOT: Internal error details (`err.message`, `error.message`, stack traces) MUST NOT be returned to the client in any API response in the production environment; error responses MUST use generic, non-leaking messages.
2. MUST NOT applies to: `engagement.js` (~line 150 and viewers endpoint), `posts.js` (any `details: err.message` path reachable in production), and `home.js` (unconditional `message: error.message`).
3. MUST: The viewers endpoint (`GET /api/engagement/viewers/:postId`) MUST enforce a maximum `limit` of 100 results, consistent with the cap already applied in the comments endpoint.
4. MUST: Any endpoint that accepts a `limit` or `offset` query parameter MUST validate and cap that parameter to a safe maximum before executing the database query.
5. MUST NOT: The `engagement.js` viewers endpoint MUST NOT grant access based solely on `posts.user_id` when `posts.creator_id` may be the authoritative ownership column for a post; both columns MUST be checked.
6. SHOULD: Rate limits that protect engagement and feed endpoints SHOULD be backed by a persistent store (e.g., Redis) rather than in-memory state so that limits survive process restarts and scale across multiple instances.

---

### 11. Performance

#### Acceptance Criteria
1. SHOULD: `GET /api/feed` and `GET /api/home/feed` SHOULD implement cursor-based or keyset pagination so that repeated requests do not always re-fetch and rank 100 candidates from scratch.
2. MUST NOT: Feed queries MUST NOT use `SELECT *` on the `posts` table when only a known subset of columns is required; queries SHOULD enumerate only the columns needed.
3. MUST: The `feed_impressions` table MUST have a unique index on `(user_id, post_id, action)` for the `ON CONFLICT` clause in the impression insert to work correctly.
4. SHOULD: Frequently-read, slowly-changing feed data (e.g., ranked candidate sets) SHOULD be cached with a TTL appropriate for the content's freshness requirements, using a mechanism that does not require changes to `feedRanker.js` or `rankingEngine.js`.
5. SHOULD: Profile content queries (`getPostsByCreator`) that enumerate all posts for a creator SHOULD return only the columns required by `formatPost` and the frontend, not full-row `SELECT *`.
6. MUST NOT: Performance optimizations MUST NOT alter the shape or fields of any API response contract already consumed by the frontend.

---

## Glossary

- **Respect**: Drandee's equivalent of a "like" — a positive engagement action on a post, stored in the `respects` table and counted in `posts.total_respects`.
- **has_respected**: Boolean field returned by `formatPost` in `postModel.js` indicating whether the authenticated viewer has already respected a given post.
- **engagement_updated**: Custom browser `CustomEvent` dispatched by `dispatchEngagementUpdated` in `engagementSync.js` to synchronize engagement state across screens without prop drilling.
- **formatPost**: Function in `postModel.js` that normalizes a raw database row into the canonical frontend post shape, populating `stats`, `content`, `creator`, `engagement`, and flat compat fields.
- **PostActions**: React component (`PostActions.jsx`) rendering the respect, comment, share, save, and views buttons below a post. Owns local optimistic state for `hasRespected` and `respects`.
- **UserContext**: React context (`UserContext.jsx`) providing `giveRespect`, `savePost`, `incrementShare`, and related actions, plus the `user` and `posts` arrays, to all screens.
- **ProfileContentViewer**: React component (`ProfileContentViewer.jsx`) rendering a full-screen scrollable stack of a user's posts, with snap-scroll navigation and sheet modals (comment, share, save, more).
- **watch_count**: Database column on the `posts` table tracking how many times a post has been viewed; maps to `stats.views` in `formatPost`.
- **feed_impressions**: Database table recording that a user was shown (or watched) a specific post; used by the viewers endpoint and impression tracking.
- **creator_id / user_id**: Both columns exist on `posts`; `user_id` is the primary FK, `creator_id` is a legacy duplicate set to the same value on insert. Ownership checks must consult both.
