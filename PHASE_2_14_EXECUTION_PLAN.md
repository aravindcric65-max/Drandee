# Phase 2-14 Execution Plan

## PHASE 2: Post Content & Media

### Bug 1-2: Thumbnail Generation & Display
- **ROOT CAUSE**: UploadStudio.jsx line 133 has hardcoded mock thumbnailUrl
- **FIX**: Capture ImageKit thumbnailUrl from actual upload response, pass to backend
- **FILES**: 
  - `backend/frontend/src/pages/UploadStudio.jsx` (fix completeUpload)
  - `backend/frontend/src/components/studio/CoverSelector.jsx` (capture actual thumbnail)
  - `backend/routes/upload.js` (store thumbnailUrl properly)
- **STATUS**: CODE

### Bug 3-4: Caption Display & Read More/Less
- **ROOT CAUSE**: Need CaptionDisplay component with expand/collapse
- **FIX**: Create reusable CaptionDisplay component
- **FILES**:
  - `backend/frontend/src/components/CaptionDisplay.jsx` (CREATE)
  - `backend/frontend/src/pages/Reels.jsx` (integrate)
  - `backend/frontend/src/components/FeedCard.jsx` (integrate)
- **STATUS**: CODE

### Bug 5: Hashtags Not Displaying
- **ROOT CAUSE**: Need hashtag parser and clickable links
- **FIX**: Create hashtag parser utility
- **FILES**:
  - `backend/frontend/src/utils/hashtagParser.js` (CREATE)
  - Integrate into CaptionDisplay
- **STATUS**: CODE

## PHASE 3: Layout & Scrolling

### Bug 6-7: Profile & Settings Scrolling
- **ROOT CAUSE**: Missing overflow-y-auto, using 100vh instead of 100dvh
- **FIX**: Update CSS classes
- **FILES**:
  - `backend/frontend/src/pages/Profile.jsx`
  - `backend/frontend/src/pages/Settings.jsx`
- **STATUS**: CODE

## PHASE 4: Profile Features

### Bug 8: Edit Profile
- **ROOT CAUSE**: Need to trace existing route and fix navigation
- **FIX**: Verify route exists, fix navigation
- **FILES**: TBD after inspection
- **STATUS**: INSPECT

### Bug 9: Add Account
- **ROOT CAUSE**: Feature incomplete
- **FIX**: Implement basic multi-account UI
- **FILES**: TBD
- **STATUS**: INSPECT

## PHASE 5: Search System

### Bug 10-11: Search Reliability & Real-Time
- **ROOT CAUSE**: Need optimized queries and debounced search
- **FIX**: Add full-text search indexes, implement debounce
- **FILES**:
  - `backend/routes/search.js`
  - `backend/frontend/src/pages/Search.jsx`
- **STATUS**: CODE

## PHASE 6: Notifications

### Bug 12-13: Notifications & Real-Time
- **ROOT CAUSE**: Notification service incomplete
- **FIX**: Create notification utility, polling system
- **FILES**:
  - `backend/utils/notificationService.js` (CREATE)
  - `backend/routes/engagement.js` (trigger notifications)
  - `backend/frontend/src/hooks/useNotifications.js` (CREATE)
- **STATUS**: CODE

## PHASE 7: Private Accounts

### Bug 14-17: Private Account System
- **ROOT CAUSE**: Follow requests table missing, authorization incomplete
- **FIX**: Create follow_requests table, implement authorization
- **FILES**:
  - Migration script
  - `backend/routes/user.js` (follow logic)
  - `backend/middleware/checkPrivateAccess.js` (CREATE)
- **STATUS**: CODE + DATABASE

## PHASE 8: Saved Content

### Bug 18-19: Saved Posts/Videos
- **ROOT CAUSE**: saved_posts syncing issues
- **FIX**: Ensure column exists, API endpoints work
- **FILES**:
  - `backend/routes/bookmarks.js`
  - Migration to ensure saved_posts column
- **STATUS**: CODE + DATABASE

## PHASE 9: Engagement Regression

### Bug 20: Scope Errors
- **ROOT CAUSE**: Variables declared inside try block
- **FIX**: Move declarations outside try block
- **FILES**:
  - `backend/frontend/src/context/UserContext.jsx`
- **STATUS**: CODE

## PHASE 10: Feed Algorithms

### Bug 21-23: Feed Algorithm Issues
- **ROOT CAUSE**: Missing WHERE clauses, incomplete user object
- **FIX**: Add creator_id != current_user_id filters
- **FILES**:
  - `backend/routes/feed.js`
  - `backend/routes/home.js`
- **STATUS**: CODE

## PHASE 11: SPA & State Management

### Bug 24: SPA Navigation
- **ROOT CAUSE**: window.location.href usage
- **FIX**: Replace with navigate() from useNavigate
- **FILES**: Multiple components
- **STATUS**: CODE

### Bug 25: Refresh Persistence
- **ROOT CAUSE**: State not persisted
- **FIX**: Use sessionStorage
- **FILES**: Multiple pages
- **STATUS**: CODE

### Bug 26: Post Delete Propagation
- **ROOT CAUSE**: No custom events
- **FIX**: Dispatch/listen for post_deleted events
- **FILES**: Multiple components
- **STATUS**: CODE

## PHASE 12: System Integrity

### Bug 27: Database Schema
- **ROOT CAUSE**: Missing indexes, columns
- **FIX**: Migration script
- **FILES**: Migration script
- **STATUS**: DATABASE

### Bug 28: Production Build
- **ROOT CAUSE**: Build errors
- **FIX**: Test npm run build
- **FILES**: N/A
- **STATUS**: BUILD

## Execution Order
1. Phase 2 (Thumbnails, Captions, Tags)
2. Phase 3 (CSS Fixes)
3. Phase 9 (Scope Errors - Quick Fix)
4. Phase 10 (Feed Filters - Quick Fix)
5. Phase 11 (SPA Navigation, State)
6. Phase 4 (Profile Features)
7. Phase 5 (Search)
8. Phase 6 (Notifications)
9. Phase 7 (Private Accounts)
10. Phase 8 (Saved Content)
11. Phase 12 (Database + Build)
12. Phase 13-14 (Final Testing)
