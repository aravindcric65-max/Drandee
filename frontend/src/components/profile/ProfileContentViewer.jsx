import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { determineContentType } from '../../utils/contentType';
import { FeedItem } from '../home/FeedItem';
import CommentModal from '../home/CommentModal';
import ShareModal from '../home/ShareModal';
import SaveModal from '../home/SaveModal';
import { MoreMenu } from '../home/MoreMenu';
import { ViewersModal } from '../home/ViewersModal';
import { applyEngagementEventToPosts } from '../../utils/engagementSync';
import { UserContext } from '../../context/UserContext';

export const ProfileContentViewer = ({
  posts: initialPosts,
  selectedPostId,
  selectedPostSnapshot = null,
  tab = 'images',
  onClose,
  isOwn,
  onDelete,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const viewTrackedRef = useRef(new Set());
  const touchStartYRef = useRef(null);

  // Pull canonical engagement actions from UserContext
  const {
    giveRespect,
    incrementShare,
    markWatched,
    user,
  } = useContext(UserContext) || {};

  // Maintain local post state so engagement events propagate correctly
  // Merge the selected post snapshot as a fallback so the viewer can open
  // even if the parent's posts array hasn't been populated yet.
  const [posts, setPosts] = useState(() => {
    const arr = initialPosts || [];
    if (selectedPostSnapshot && !arr.some(p => String(p.id) === String(selectedPostSnapshot.id))) {
      return [selectedPostSnapshot, ...arr];
    }
    return arr;
  });

  useEffect(() => {
    let arr = initialPosts || [];
    if (selectedPostSnapshot && !arr.some(p => String(p.id) === String(selectedPostSnapshot.id))) {
      arr = [selectedPostSnapshot, ...arr];
    }
    setPosts(arr);
    // Reset view tracking when posts change
    viewTrackedRef.current = new Set();
  }, [initialPosts, selectedPostSnapshot]);

  // Subscribe to cross-component engagement events
  useEffect(() => {
    const handleEngagement = (e) => {
      setPosts((prev) => applyEngagementEventToPosts(prev, e.detail));
    };
    window.addEventListener('engagement_updated', handleEngagement);
    return () => window.removeEventListener('engagement_updated', handleEngagement);
  }, []);

  const viewerPosts = useMemo(() => {
    return posts.filter((post) => {
      const type = determineContentType(post);
      if (tab === 'reels') return type === 'video';
      if (tab === 'text') return type === 'text';
      if (tab === 'images') return type === 'image' || type === 'carousel';
      if (tab === 'featured') return post.isFeatured || post.is_featured;
      return true; // tab === 'all'
    });
  }, [posts, tab]);

  // Modal state
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [activeSharePostId, setActiveSharePostId] = useState(null);
  const [activeSavePostId, setActiveSavePostId] = useState(null);
  const [activeMorePostId, setActiveMorePostId] = useState(null);
  const [activeViewersPostId, setActiveViewersPostId] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, viewerPosts.findIndex((p) => String(p.id) === String(selectedPostId)))
  );

  useEffect(() => {
    const idx = viewerPosts.findIndex((p) => String(p.id) === String(selectedPostId));
    if (idx >= 0) setCurrentIndex(idx);
  }, [selectedPostId, viewerPosts]);

  // Scroll to current post
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: currentIndex * window.innerHeight, behavior: 'smooth' });
    }
  }, [currentIndex]);

  // Track view when post becomes active — deduplicated per session
  useEffect(() => {
    const post = viewerPosts[currentIndex];
    if (!post) return;
    const postId = post.id;
    if (viewTrackedRef.current.has(postId)) return;
    viewTrackedRef.current.add(postId);
    if (markWatched) {
      markWatched(postId);
    }
    if (onNavigate) onNavigate(postId);
  }, [currentIndex, viewerPosts, markWatched, onNavigate]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const idx = Math.round(containerRef.current.scrollTop / window.innerHeight);
    if (idx !== currentIndex && idx >= 0 && idx < viewerPosts.length) {
      setCurrentIndex(idx);
    }
  }, [currentIndex, viewerPosts.length]);

  // Lock body scroll while viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard navigation — ArrowDown/ArrowUp navigate between posts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex + 1;
        if (next < viewerPosts.length) {
          setCurrentIndex(next);
          containerRef.current?.scrollTo({ top: next * window.innerHeight, behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex - 1;
        if (prev >= 0) {
          setCurrentIndex(prev);
          containerRef.current?.scrollTo({ top: prev * window.innerHeight, behavior: 'smooth' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, viewerPosts.length, onClose]);

  // Touch intercept — prevent inner card scroll from consuming cross-boundary swipes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (touchStartYRef.current === null) return;
      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      const innerCard = e.target.closest('.overflow-y-auto');
      if (!innerCard) return;
      const atTop = innerCard.scrollTop <= 0;
      const atBottom = innerCard.scrollTop >= innerCard.scrollHeight - innerCard.clientHeight - 1;
      if ((deltaY < -10 && atBottom) || (deltaY > 10 && atTop)) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      touchStartYRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Engagement handlers — use UserContext functions directly
  const handleRespect = useCallback((postId) => {
    if (giveRespect) giveRespect(postId);
  }, [giveRespect]);

  const handleComment = useCallback((postId) => {
    setActiveCommentPostId(postId);
  }, []);

  const handleShare = useCallback((postId) => {
    setActiveSharePostId(postId);
    // incrementShare is called via ShareModal's onShareComplete callback
    // — only after the user actually selects a platform, not on modal open
  }, []);

  const handleSave = useCallback((postId) => {
    setActiveSavePostId(postId);
  }, []);

  const handleMore = useCallback((postId, creatorId) => {
    setActiveMorePostId(postId);
  }, []);

  const handleViewers = useCallback((postId, creatorId) => {
    if (String(creatorId) === String(user?.id)) {
      setActiveViewersPostId(postId);
    }
  }, [user?.id]);

  const handleTagClick = useCallback((tag) => {
    onClose();
    navigate(`/tag/${tag.replace('#', '')}`);
  }, [onClose, navigate]);

  if (viewerPosts.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#080808] flex flex-col items-center justify-center gap-4" style={{ height: '100dvh' }}>
        <p className="text-white text-base">Post not found</p>
        <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-white" style={{ background: '#7F77DD' }}>
          Close
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Main viewer overlay */}
      <div className="fixed inset-0 z-[9999] bg-[#080808] flex justify-center" style={{ height: '100dvh' }}>
        {/* Back button — pointer-events-none on parent, auto on button */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center z-[10000] pt-[max(16px,env(safe-area-inset-top))] pointer-events-none">
          <button
            type="button"
            onClick={onClose}
            className="p-3 -ml-2 rounded-full bg-white/10 hover:bg-white/20 pointer-events-auto transition-colors focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close viewer"
          >
            <ArrowLeft size={24} color="#fff" />
          </button>
        </div>

        {/* Scrollable post stack */}
        <div
          ref={containerRef}
          className="w-full max-w-[500px] h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar relative z-50"
          onScroll={handleScroll}
        >
          {viewerPosts.map((post, i) => {
            const isVisible = Math.abs(i - currentIndex) <= 2;

            return (
              <div
                key={post.id}
                className="w-full shrink-0 snap-center relative flex flex-col items-center justify-center px-2 sm:px-4"
                style={{ height: '100dvh' }}
              >
                {isVisible ? (
                  <div className="w-full bg-[#1a1a1a] rounded-[20px] p-4 sm:p-5 overflow-y-auto max-h-[85vh] hide-scrollbar border border-[#252525]">
                    <FeedItem
                      post={post}
                      isActive={i === currentIndex}
                      index={i}
                      mode="profile"
                      onRespect={handleRespect}
                      onComment={handleComment}
                      onShare={handleShare}
                      onSave={handleSave}
                      interactionProps={{
                        onMore: handleMore,
                        onTagClick: handleTagClick,
                        onViewsClick: handleViewers,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals rendered OUTSIDE the scroll container and ABOVE z-[9999]
          to avoid overflow clipping and stacking context issues */}
      {activeCommentPostId && (
        <CommentModal
          isOpen={true}
          postId={activeCommentPostId}
          onClose={() => setActiveCommentPostId(null)}
        />
      )}
      {activeSharePostId && (
        <ShareModal
          isOpen={true}
          postId={activeSharePostId}
          onClose={() => setActiveSharePostId(null)}
          onShareComplete={() => {
            if (incrementShare && activeSharePostId) incrementShare(activeSharePostId);
          }}
        />
      )}
      {activeSavePostId && (
        <SaveModal
          isOpen={true}
          postId={activeSavePostId}
          onClose={() => setActiveSavePostId(null)}
        />
      )}
      <MoreMenu
        isOpen={!!activeMorePostId}
        onClose={() => setActiveMorePostId(null)}
        postId={activeMorePostId}
        isOwner={isOwn}
        onDeleteSuccess={(deletedId) => {
          if (onDelete) onDelete(deletedId);
          setActiveMorePostId(null);
        }}
      />
      {activeViewersPostId && (
        <ViewersModal
          isOpen={true}
          postId={activeViewersPostId}
          onClose={() => setActiveViewersPostId(null)}
        />
      )}
    </>
  );
};

export default ProfileContentViewer;
