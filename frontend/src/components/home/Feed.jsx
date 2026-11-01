import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FeedItem from './FeedItem';
import FeedSkeleton from './FeedSkeleton';
import FeedError from './FeedError';
import FeedEmpty from './FeedEmpty';
import FeedEnd from './FeedEnd';
import { applyEngagementEventToPosts } from '../../utils/engagementSync';
import { UserContext } from '../../context/UserContext';

const feedCache = {
  for_you: { posts: null, cursor: null, hasMore: true, scrollTop: 0 },
  following: { posts: null, cursor: null, hasMore: true, scrollTop: 0 },
  local: { posts: null, cursor: null, hasMore: true, scrollTop: 0 }};

export const Feed = ({ 
  mode = 'for_you', 
  isActive = true,
  onRespect, 
  onComment, 
  onShare, 
  onSave, 
  onFollow, 
  onMore,
  hiddenPosts = [],
  interactionProps
}) => {
  const { user } = useContext(UserContext) || {};
  const [posts, setPosts] = useState(() => feedCache[mode]?.posts || []);
  const [loading, setLoading] = useState(() => !feedCache[mode]?.posts);
  const [error, setError] = useState(false);
  const [networkLow, setNetworkLow] = useState(false);
  const [cursor, setCursor] = useState(() => feedCache[mode]?.cursor || null);
  const [hasMore, setHasMore] = useState(() => feedCache[mode]?.hasMore ?? true);
  const [activePostIndex, setActivePostIndex] = useState(0);

  const observerRef = useRef(null);
  const loadingRef = useRef(false);
  const trackedImpressions = useRef(new Set());
  const feedContainerRef = useRef(null);

  // Keep a mutable ref of state for stable callbacks and observers
  const stateRef = useRef({ posts, hasMore, cursor });
  useEffect(() => {
    stateRef.current = { posts, hasMore, cursor };
  }, [posts, hasMore, cursor]);

  // Memoize hidden posts set for faster lookup
  const hiddenPostsSet = useMemo(() => new Set(hiddenPosts), [hiddenPosts]);

  const fetchFeed = useCallback(async (isLoadMore = false, retryCount = 0) => {
    const currentState = stateRef.current;
    if (loadingRef.current || (!currentState.hasMore && isLoadMore)) return;
    
    loadingRef.current = true;
    if (!isLoadMore && retryCount === 0) setLoading(true);
    setError(false);

    try {
      const url = new URL('/api/home/feed', window.location.origin);
      url.searchParams.append('mode', mode);
      if (isLoadMore && currentState.cursor) {
        url.searchParams.append('cursor', currentState.cursor);
      }
      url.searchParams.append('limit', '20');

      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('user');
          import('../../firebase/config').then(({ auth }) => {
            if (auth.currentUser) {
              import('firebase/auth').then(({ signOut }) => {
                signOut(auth).catch(console.error);
              });
            }
          });
          return;
        }
        
        try {
          const errData = await res.json();
          throw new Error(`Server returned ${res.status}: ${errData.message || errData.error || 'Unknown'}`);
        } catch(e) {
          throw new Error(`Server returned ${res.status}`);
        }
      }
      const data = await res.json();

      if (data.success) {
        setPosts(prev => {
          let newPosts;
          if (isLoadMore) {
            // Deduplicate incoming posts that are already in the feed
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNew = data.data.items.filter(p => !existingIds.has(p.id));
            newPosts = [...prev, ...uniqueNew];
          } else {
            newPosts = data.data.items;
          }
          if (feedCache[mode]) feedCache[mode].posts = newPosts;
          return newPosts;
        });
        setCursor(data.data.nextCursor);
        setHasMore(data.data.hasMore);
        
        if (feedCache[mode]) {
          feedCache[mode].cursor = data.data.nextCursor;
          feedCache[mode].hasMore = data.data.hasMore;
        }
      } else {
        throw new Error(data.error?.message || 'Failed to fetch feed');
      }
    } catch (err) {
      console.error('Feed error:', err);
      if (retryCount < 1) {
        // Retry once after 3 seconds for Neon DB timeout mitigation
        loadingRef.current = false;
        setTimeout(() => fetchFeed(isLoadMore, retryCount + 1), 3000);
        return;
      }
      setError(true);
      setNetworkLow(true);
      setTimeout(() => setNetworkLow(false), 2000);
    } finally {
      if (loadingRef.current) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  }, [mode]);

    // Initial fetch on mount or mode change
    useEffect(() => {
      const cached = feedCache[mode];
      if (cached && cached.posts && cached.posts.length > 0) {
        setPosts(cached.posts);
        setCursor(cached.cursor);
        setHasMore(cached.hasMore);
        setActivePostIndex(0);
        trackedImpressions.current = new Set();
        setLoading(false);
      } else {
        setPosts([]);
        setCursor(null);
        setHasMore(true);
        setActivePostIndex(0);
        trackedImpressions.current = new Set();
        fetchFeed(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

  // Intersection Observer for Infinite Scroll & Active Video tracking
  useEffect(() => {
    const options = {
      root: feedContainerRef.current,
      rootMargin: '0px',
      threshold: 0.6 // 60% visible to be considered active
    };

    const handleIntersection = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.dataset.index, 10);
          if (!isNaN(index)) {
            setActivePostIndex(index);
            
            // Track impression
            const currentPosts = stateRef.current.posts;
            const postId = currentPosts[index]?.id;
            if (postId && trackedImpressions.current && !trackedImpressions.current.has(postId)) {
              trackedImpressions.current.add(postId);
              fetch('/api/home/impression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  postId: postId, 
                  action: 'scroll_view',
                  dwellTime: 1000
                })
              }).catch(() => {
                // If request failed (e.g. auth not ready), remove from tracked so it can retry
                if (trackedImpressions.current) {
                  trackedImpressions.current.delete(postId);
                }
              });
            }

            // Load more if we are 3 items away from the end
            if (index >= currentPosts.length - 3 && stateRef.current.hasMore) {
              fetchFeed(true);
            }
          }
        }
      });
    };

    observerRef.current = new IntersectionObserver(handleIntersection, options);

    // Listen for new posts
    const handleNewPost = (e) => {
      if (e.detail) {
        // For the 'following' feed: only inject the new post if the creator is
        // someone the current user actually follows. user.following from UserContext
        // is the canonical client-side follow list, kept in sync with follow/unfollow actions.
        if (mode === 'following') {
          const creatorId = e.detail.userId ?? e.detail.user_id;
          const following = user?.following || [];
          if (!following.includes(creatorId) && !following.includes(String(creatorId))) {
            return; // skip — unfollowed creator
          }
        }

        // For all other modes, add to the top of the feed
        setPosts(prev => {
          // Check if it already exists
          if (prev.some(p => p.id === e.detail.id)) return prev;
          const newPosts = [e.detail, ...prev];
          
          // Update cache
          if (feedCache[mode]) {
            feedCache[mode].posts = newPosts;
          }
          
          return newPosts;
        });
      }
    };

    // Listen for deleted posts
    const handlePostDeleted = (e) => {
      const { postId } = e.detail;
      if (stateRef.current.posts.some(p => p.id === postId)) {
        setPosts(prev => {
          const newPosts = prev.filter(p => p.id !== postId);
          if (feedCache[mode]) {
            feedCache[mode].posts = newPosts;
          }
          return newPosts;
        });
      }
    };
      
    const handleEngagement = (e) => {
      setPosts((prev) => {
        const newPosts = applyEngagementEventToPosts(prev, e.detail);
        if (feedCache[mode]) feedCache[mode].posts = newPosts;
        return newPosts;
      });
    };
      
    window.addEventListener('new_post_published', handleNewPost);
    window.addEventListener('post_deleted', handlePostDeleted);
    window.addEventListener('engagement_updated', handleEngagement);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      window.removeEventListener('new_post_published', handleNewPost);
      window.removeEventListener('post_deleted', handlePostDeleted);
      window.removeEventListener('engagement_updated', handleEngagement);
    };
  }, [mode, fetchFeed, user?.following]);

  // Register refs for observer
  const setRef = useCallback((el, index) => {
    if (el && observerRef.current) {
      el.dataset.index = String(index);
      observerRef.current.observe(el);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      trackedImpressions.current = null;
    };
  }, []);

  // Restore scroll position when remounted or mode changes
  React.useLayoutEffect(() => {
    const cached = feedCache[mode];
    if (cached && feedContainerRef.current && cached.posts && cached.posts.length > 0) {
      feedContainerRef.current.scrollTop = cached.scrollTop || 0;
    }
  }, [mode]);

  // Render states
  if (loading && posts.length === 0) {
    return <FeedSkeleton />;
  }
  
  if (error && posts.length === 0) {
    return <FeedError onRetry={() => fetchFeed(false)} />;
  }
  
  if (!loading && posts.length === 0) {
    return <FeedEmpty mode={mode} />;
  }

  return (
    <div 
      ref={feedContainerRef}
      onScroll={(e) => {
        if (feedCache[mode]) {
          feedCache[mode].scrollTop = e.target.scrollTop;
        }
      }}
      className="w-full h-full overflow-y-auto overflow-x-hidden bg-transparent px-3 sm:px-4 md:px-5 pb-24 sm:pb-32 pt-2 sm:pt-3 [scrollbar-color:rgba(185,180,255,0.25)_transparent] [scrollbar-width:thin]"
      role="feed"
      aria-label={`${mode.replace('_', ' ')} feed`}
      aria-busy={loading}
    >
      <AnimatePresence>
        {networkLow && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-black/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-white text-[13px] font-medium border border-white/10"
          >
            Network low
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {posts.map((post, index) => {
          const isHidden = hiddenPostsSet.has(post.id);
          
          return (
            <motion.article 
              key={post.id} 
              layout
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, paddingBottom: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              ref={(el) => setRef(el, index)} 
              className="w-full mb-5 sm:mb-6 md:mb-8 pb-5 sm:pb-6 md:pb-8 border-b border-white/[0.05] last:border-0 last:mb-24 sm:last:mb-32 overflow-hidden"
              role="article"
              aria-label={`Post ${index + 1} of ${posts.length}`}
            >
              {!isHidden ? (
                <FeedItem 
                  post={post} 
                  isActive={isActive && index === activePostIndex} 
                  index={index}
                  mode={mode}
                  onRespect={onRespect}
                  onComment={onComment}
                  onShare={onShare}
                  onSave={onSave}
                  onFollow={onFollow}
                  onMore={onMore}
                  interactionProps={interactionProps}
                />
              ) : (
                <div 
                  className="w-full flex items-center justify-center py-8 sm:py-10"
                  role="status"
                  aria-label="Post hidden"
                >
                  <span className="text-white/50 text-[12px] sm:text-[13px] font-medium px-5 py-2.5 bg-white/5 rounded-full">
                    We'll show you less like this
                  </span>
                </div>
              )}
            </motion.article>
          );
        })}
      </AnimatePresence>
      
      {/* Loading more indicator */}
      {loading && posts.length > 0 && (
        <div 
          className="w-full flex flex-col items-center pb-16 sm:pb-20"
          role="status"
          aria-label="Loading more posts"
        >
          <div className="w-full max-w-[400px] space-y-4">
            <FeedSkeleton />
            <div className="h-4 w-full opacity-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}></div>
            <FeedSkeleton />
          </div>
        </div>
      )}

      {/* End of Feed State */}
      {!loading && !hasMore && posts.length > 0 && (
        <FeedEnd />
      )}
    </div>
  );
};

export default Feed;