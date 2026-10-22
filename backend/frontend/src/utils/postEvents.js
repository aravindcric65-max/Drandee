/**
 * Post Event System - Custom events for post lifecycle
 * Usage: Dispatch events when posts are created/updated/deleted
 * Listen to events in components to update local state
 */

/**
 * Dispatch post deleted event
 * @param {number} postId - ID of deleted post
 */
export const dispatchPostDeleted = (postId) => {
  window.dispatchEvent(
    new CustomEvent('post_deleted', {
      detail: { postId }
    })
  );
};

/**
 * Dispatch post created event
 * @param {object} post - New post object
 */
export const dispatchPostCreated = (post) => {
  window.dispatchEvent(
    new CustomEvent('post_created', {
      detail: { post }
    })
  );
};

/**
 * Dispatch post updated event
 * @param {number} postId - ID of updated post
 * @param {object} updates - Updated fields
 */
export const dispatchPostUpdated = (postId, updates) => {
  window.dispatchEvent(
    new CustomEvent('post_updated', {
      detail: { postId, updates }
    })
  );
};

/**
 * Hook to listen for post deleted events
 * Usage in component:
 * 
 * useEffect(() => {
 *   const handlePostDeleted = (e) => {
 *     const { postId } = e.detail;
 *     setPosts(prev => prev.filter(p => p.id !== postId));
 *   };
 *   
 *   window.addEventListener('post_deleted', handlePostDeleted);
 *   return () => window.removeEventListener('post_deleted', handlePostDeleted);
 * }, []);
 */

/**
 * Example integration in delete function:
 * 
 * const deletePost = async (postId) => {
 *   try {
 *     await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
 *     dispatchPostDeleted(postId); // Propagate to all views
 *   } catch (error) {
 *     console.error('Delete failed:', error);
 *   }
 * };
 */
