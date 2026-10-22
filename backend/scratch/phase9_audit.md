# DRANDEE — PHASE 9 FULL REPOSITORY AUDIT

## 1. Existing Architecture
*   **Routing**: Standard React Router v6 implementation in `AppRoutes.jsx`.
*   **Global State**: `UserContext.jsx` manages user profiles, optimistic updates for `giveRespect`, `savePost`, `followUser`, `unfollowUser`, and basic real-time polling (10s) for notifications. `UploadContext` handles the upload pipeline.
*   **Feed System**: `Home.jsx` acts as the container for `Feed.jsx`. It supports multiple feed modes (For You, Following, Spotlight). The ranking algorithm (`utils/feedRanker.js`) is protected.
*   **Profile**: `Profile.jsx` contains the user's details, grid of posts, and the `ProfilePostViewer` for vertical swiping.
*   **Notifications**: Handled via `Notifications.jsx` and polling in `UserContext`. Displays a TikTok-style 4-metric animated bar.
*   **Upload Studio**: Complex form handled in `UploadStudio.jsx` with progressive disclosure.
*   **Modals**: Global modals are heavily utilized (`CommentModal`, `ShareModal`, `MoreMenu`, `ViewersModal`).

## 2. Existing Reusable Components
*   `Navbar`: Fixed bottom navigation for mobile, side navigation for desktop.
*   `DrandeeLogo.jsx` & `DrandeeWordmark.jsx`: The absolute single source of truth for branding.
*   `Button.jsx`: Generic UI button, but often bypassed in favor of raw `<button>` tags.
*   `Modal.jsx`: Base modal component.
*   `GlobalUploadToast.jsx`: Existing feedback system for uploads.

## 3. UX Problems Found
*   **Interactions (Respect/Save)**: The UI buttons lack immediate, fluid micro-interaction feedback (e.g., a subtle scale down on tap). Rapid tapping could bypass React state batching and trigger multiple API calls.
*   **Follow/Unfollow**: State is updated optimistically, but the UI lacks a transitional "Loading" state during API transit.
*   **Comments**: The `CommentModal` needs to ensure the submit button is strictly disabled while submitting to prevent duplicate comments.
*   **Share**: The current share logic needs to reliably fall back to copying the canonical URL if the native Web Share API fails.
*   **Empty States**: Some lists may have generic or poorly padded empty states.

## 4. Performance Problems Found
*   **Event Listeners**: Custom events like `new_notification` and `new_post_published` exist. We must audit all `useEffect` hooks listening to these to ensure exact `removeEventListener` cleanup.
*   **Re-renders**: Rapid polling in `UserContext` triggers re-renders. We must ensure child components don't aggressively re-render.

## 5. Mobile Problems Found
*   **Safe Areas**: Several absolute/fixed containers might overlap with the iOS home indicator. Need to systematically apply `env(safe-area-inset-bottom)`.
*   **Touch Targets**: Some icon buttons might be smaller than the recommended 44px minimum touch target.
*   **Keyboard**: The `CommentModal` input might get obscured by the virtual keyboard on smaller mobile devices.

## 6. Accessibility Problems Found
*   **Aria Labels**: Many interaction buttons lack robust `aria-label`s describing their current state.
*   **Focus Management**: Modals need to trap focus and allow closing via the `Escape` key.

## 7. Recommended Surgical Fixes
1.  **Micro-interactions**: Wrap primary interaction buttons in Framer Motion `<motion.button>` with `whileTap={{ scale: 0.95 }}`.
2.  **Debouncing & Loading States**: Add localized `isSubmitting` states to `CommentModal`, `UploadStudio`, and Follow buttons.
3.  **Share UX**: Implement `navigator.share` in `ShareModal`/`Feed` with a fallback to `navigator.clipboard.writeText` and trigger a minimalist toast.
4.  **Safe Areas**: Add `env(safe-area-inset-bottom)` to the main feed and profile scroll containers.
5.  **Event Listener Audit**: Ensure every single `addEventListener` has a matching `removeEventListener`.
6.  **Aria Enhancements**: Add explicit dynamic `aria-label`s to all icon-only buttons.

