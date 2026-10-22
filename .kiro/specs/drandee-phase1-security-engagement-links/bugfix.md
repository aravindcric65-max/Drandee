# Bugfix Requirements Document

## Introduction

This document captures the confirmed open bugs for the Drandee social media platform (Node.js/Express backend, React frontend, Neon PostgreSQL, Firebase Auth) on branch `pass4-fixes`. Prior sessions have already addressed: content_type Reels filter, window.location navigation, and Profile tab labels. The 14 remaining bugs span four groups: Settings UI/API gaps (A1–A7), Auth interceptor reliability (B1–B2), Engagement logic correctness (C1–C2), and Route integrity (D1–D2). All fixes must be minimal-diff, backward-compatible, and must not touch protected files.

---

## Bug Analysis

### Current Behavior (Defect)

**Group A — Settings**

1.1 WHEN `apiCall` in `Settings.jsx` makes a network request and the request fails (network error or HTTP 4xx/5xx) THEN the system throws an uncaught exception or silently treats the error response as success because there is no try/catch and no non-2xx status guard.

1.2 WHEN `NotificationsCenter` loads notification preferences THEN the system only renders 3 toggle fields (push, email, respect) and does not render the 5 additional fields the backend returns (comment, follow, mention, reply, system), causing those 5 fields to be sent as `undefined` on save.

1.3 WHEN `undefined` notification preference values are received by the backend THEN the system coerces them to `true`, silently overwriting the user's actual stored preferences.

1.4 WHEN a user navigates to the Blocked Accounts tab in Settings THEN the system shows a static placeholder with no real data because no `GET /api/engagement/blocks` endpoint exists to retrieve the blocked accounts list.

1.5 WHEN a user navigates to the Muted Accounts tab in Settings THEN the system shows a static placeholder with no real data because no mute list or mute toggle endpoints exist, despite the `user_mutes` table being present in the database.

1.6 WHEN `DataPrivacyCenter` receives an HTTP 400 response (account deletion already pending) THEN the system calls `logout()`, incorrectly signing the user out instead of handling the conflict gracefully.

1.7 WHEN a user with a pending account deletion visits `DataPrivacyCenter` THEN the system does not display the pending deletion status because it does not fetch or render that state on mount.

1.8 WHEN `DataPrivacyCenter` renders THEN the system does not show a cancel-deletion button, even though the `POST /api/data/deletion/cancel` endpoint exists and cancellation is a valid user action.

1.9 WHEN the settings page mounts and needs to show pending deletion status THEN the system cannot retrieve it because no `GET /api/data/deletion/status` endpoint exists.

1.10 WHEN `AccountCenter`, `SecurityCenter`, or `NotificationsCenter` mounts and begins fetching initial data THEN the system renders a stale empty state (no loading indicator) until the fetch resolves.

**Group B — Auth Interceptor**

1.11 WHEN an API request receives a 401 response and the token refresh retry also fails THEN the system unconditionally redirects the user to `/login`, even when the user has a valid Firebase session and the failure is caused by a startup race condition rather than actual unauthentication.

1.12 WHEN multiple concurrent API requests each receive a 401 response THEN the system independently calls `getIdToken(true)` for each request, causing a burst of parallel token refresh calls that can exhaust Firebase token-refresh quota.

**Group C — Engagement**

1.13 WHEN `ProfileContentViewer` calls `onEngagement` for a respect action THEN the system passes a `forceAdd` argument to `giveRespect`, which does not accept that argument, creating an inconsistency with the `UserContext` signature.

1.14 WHEN a user opens `ShareModal` THEN the system increments the share count at modal open time rather than at the moment the user completes a share action (clipboard copy or destination tap), inflating share counts with uncommitted interactions.

**Group D — Route Integrity**

1.15 WHEN a lazy-loaded route module fails to import (e.g., network error or bundle error) THEN the system crashes the entire application because a single top-level `Suspense` boundary in `AppRoutes.jsx` catches all route failures with no per-route error boundary.

1.16 WHEN a notification deep link navigates to `/reels?postId=X` THEN the system's behavior for reading `postId` from the query string on mount, scrolling to the matching post, and handling a missing post gracefully is unverified and may not function correctly.

---

### Expected Behavior (Correct)

**Group A — Settings**

2.1 WHEN `apiCall` in `Settings.jsx` makes a network request THEN the system SHALL catch all thrown exceptions and treat any non-2xx HTTP response as an error, surfacing a user-visible error message instead of silently continuing.

2.2 WHEN `NotificationsCenter` loads notification preferences THEN the system SHALL render all 8 toggle fields returned by the backend (push, email, respect, comment, follow, mention, reply, system).

2.3 WHEN notification preference values are submitted to the backend THEN the system SHALL send only explicitly set boolean values and the backend SHALL reject or ignore `undefined` values rather than coercing them to `true`.

2.4 WHEN a user navigates to the Blocked Accounts tab THEN the system SHALL fetch and display the real blocked accounts list by calling a `GET /api/engagement/blocks` endpoint.

2.5 WHEN a user navigates to the Muted Accounts tab THEN the system SHALL fetch and display the real muted accounts list and SHALL provide a toggle to mute or unmute accounts via dedicated mute endpoints backed by the `user_mutes` table.

2.6 WHEN `DataPrivacyCenter` receives an HTTP 400 response indicating a deletion is already pending THEN the system SHALL display an appropriate message to the user without calling `logout()`.

2.7 WHEN a user with a pending account deletion visits `DataPrivacyCenter` THEN the system SHALL fetch and display the pending deletion status on mount so the user is aware of the pending request.

2.8 WHEN `DataPrivacyCenter` renders and a pending deletion exists THEN the system SHALL display a cancel-deletion button that calls `POST /api/data/deletion/cancel`.

2.9 WHEN the settings page mounts THEN the system SHALL be able to retrieve the account deletion status via a `GET /api/data/deletion/status` endpoint.

2.10 WHEN `AccountCenter`, `SecurityCenter`, or `NotificationsCenter` mounts and begins fetching initial data THEN the system SHALL display a loading indicator until the fetch resolves, preventing stale empty-state flicker.

**Group B — Auth Interceptor**

2.11 WHEN an API request receives a 401 response and the token refresh retry also fails THEN the system SHALL check whether the user's Firebase session is actually invalid before redirecting to `/login`, and SHALL only redirect when the session is genuinely expired or absent.

2.12 WHEN multiple concurrent API requests each receive a 401 response THEN the system SHALL share a single in-flight token refresh promise so that `getIdToken(true)` is called exactly once per refresh cycle, with all concurrent requests waiting on the same promise.

**Group C — Engagement**

2.13 WHEN `ProfileContentViewer` calls `onEngagement` for a respect action THEN the system SHALL call `giveRespect` with only the arguments defined in the `UserContext` signature, removing the unsupported `forceAdd` argument.

2.14 WHEN a user completes a share action in `ShareModal` (clipboard copy or destination tap) THEN the system SHALL increment the share count at that moment, not at modal open time.

**Group D — Route Integrity**

2.15 WHEN a lazy-loaded route module fails to import THEN the system SHALL contain the failure to that route using per-route error boundaries in `AppRoutes.jsx`, leaving all other routes functional.

2.16 WHEN a notification deep link navigates to `/reels?postId=X` THEN the system SHALL read `postId` from the query string on mount, scroll to or highlight the matching post, and display a graceful fallback when the post is not found.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `apiCall` in `Settings.jsx` receives a successful 2xx response THEN the system SHALL CONTINUE TO process the response data as before.

3.2 WHEN a user saves notification preferences that include all 8 fields with explicit boolean values THEN the system SHALL CONTINUE TO persist those values correctly.

3.3 WHEN a user blocks a creator via `POST /api/engagement/block/:creatorId` THEN the system SHALL CONTINUE TO record that block as before; only the read side is new.

3.4 WHEN `safetyFilter.js` reads from the `user_mutes` table THEN the system SHALL CONTINUE TO filter muted content correctly; mute endpoint additions must not alter this behavior.

3.5 WHEN a user requests account deletion for the first time (no pending deletion exists) THEN the system SHALL CONTINUE TO create the deletion request and handle it as before.

3.6 WHEN `DataPrivacyCenter` performs a successful deletion request THEN the system SHALL CONTINUE TO handle the success response as before.

3.7 WHEN a valid authenticated request is made and returns a non-401 response THEN the system SHALL CONTINUE TO process it without any token refresh or redirect logic.

3.8 WHEN a single 401 is received and the token refresh succeeds THEN the system SHALL CONTINUE TO retry the original request with the refreshed token as before.

3.9 WHEN `giveRespect` is called from any other caller that already passes the correct arguments THEN the system SHALL CONTINUE TO function without regression.

3.10 WHEN a share action is not completed (modal closed without sharing) THEN the system SHALL CONTINUE TO leave the share count unchanged.

3.11 WHEN all lazy-loaded route imports succeed THEN the system SHALL CONTINUE TO render routes as before with no change in navigation behavior.

3.12 WHEN the Reels page is visited without a `postId` query param THEN the system SHALL CONTINUE TO load the normal Reels feed without attempting to scroll to a post.

3.13 WHEN any of the protected files (`feedRanker.js`, `feedExperiment.js`, `rankingEngine.js`, `engagementVelocity.js`, `middleware/auth.js`, `config/firebase.js`) are in use THEN the system SHALL CONTINUE TO execute them without modification; these files must not be touched.

3.14 WHEN any existing API endpoint receives a request from a current client THEN the system SHALL CONTINUE TO respond with the same contract (backward-compatible changes only); no existing endpoint response shape may be changed in a breaking way.

3.15 WHEN SQL migrations are applied THEN the system SHALL CONTINUE TO be idempotent and non-destructive (`ADD COLUMN IF NOT EXISTS` only; no `DROP`, `TRUNCATE`, or `ALTER` that removes data).
