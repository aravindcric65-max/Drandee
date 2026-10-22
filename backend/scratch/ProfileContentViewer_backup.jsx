import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MoreVertical,
  Music, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useRelativeTime } from '../../hooks/useRelativeTime';
import DefaultAvatar from '../DefaultAvatar';
import { determineContentType, getCarouselImages, getPostMediaUrl } from '../../utils/contentType';
import { normalizeEngagement, normalizePrivacy } from '../../utils/normalizePost';
import { PostActions } from '../home/PostActions';
import RightActionBar from '../reels/RightActionBar';

const PostTimestamp = ({ createdAt }) => {
  const time = useRelativeTime(createdAt);
  return <>{time}</>;
};

const CaptionText = ({ text, postId, onTagClick, expandedCaptions, setExpandedCaptions, light = false }) => {
  if (!text) return null;
  const isExpanded = expandedCaptions[postId];
  const isLong = text.length > 100 || text.split(' ').length > 15;
  const displayText = isExpanded || !isLong ? text : `${text.slice(0, 100).trim()}…`;

  const formatted = displayText.split(/(#[a-zA-Z0-9_]+)/g).map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <span
          key={i}
          className={`${light ? 'text-[#7F77DD]' : 'text-white'} hover:underline cursor-pointer font-semibold`}
          onClick={(e) => { e.stopPropagation(); onTagClick(part.slice(1)); }}
        >
          {part}
        </span>
      );
    }
    return part;
  });

  return (
    <span className={light ? 'text-[#111111]' : 'text-white'}>
      {formatted}
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedCaptions((prev) => ({ ...prev, [postId]: !isExpanded }));
          }}
          className={`ml-1 font-semibold ${light ? 'text-[#666666]' : 'text-white/70'}`}
        >
          {isExpanded ? 'less' : 'more'}
        </button>
      )}
    </span>
  );
};




const MoreMenuDropdown = ({ post, isOwn, onClose, onDelete, onPrivacy }) => {
  const privacy = normalizePrivacy(post);
  if (!isOwn) {
    return (
      <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl overflow-hidden py-1 z-50">
        <button type="button" className="w-full px-4 py-3 text-left text-[15px] text-gray-800 hover:bg-gray-50">Not Interested</button>
        <button type="button" className="w-full px-4 py-3 text-left text-[15px] text-red-500 hover:bg-gray-50">Report Post</button>
      </div>
    );
  }
  return (
    <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl overflow-hidden py-1 z-50">
      <button type="button" onClick={() => { onPrivacy('privacy_respect', !privacy.hideRespectCount); onClose(); }}
        className="w-full px-4 py-3 text-left text-[15px] text-gray-800 hover:bg-gray-50 border-b border-gray-100">
        {privacy.hideRespectCount ? 'Show Respect Count' : 'Hide Respect Count'}
      </button>
      <button type="button" onClick={() => { onPrivacy('privacy_share', !privacy.hideShareCount); onClose(); }}
        className="w-full px-4 py-3 text-left text-[15px] text-gray-800 hover:bg-gray-50 border-b border-gray-100">
        {privacy.hideShareCount ? 'Show Share Count' : 'Hide Share Count'}
      </button>
      <button type="button" onClick={() => { onPrivacy('privacy_comments', privacy.commentsEnabled === false); onClose(); }}
        className="w-full px-4 py-3 text-left text-[15px] text-gray-800 hover:bg-gray-50 border-b border-gray-100">
        {privacy.commentsEnabled === false ? 'Turn On Comments' : 'Turn Off Comments'}
      </button>
      <button type="button" onClick={() => { onPrivacy('privacy_reuse', privacy.reuseEnabled === false); onClose(); }}
        className="w-full px-4 py-3 text-left text-[15px] text-gray-800 hover:bg-gray-50 border-b border-gray-100">
        {privacy.reuseEnabled === false ? 'Turn On Reuse' : 'Turn Off Reuse'}
      </button>
      <button type="button" onClick={() => { onClose(); if (window.confirm('Delete this post?')) onDelete(post.id); }}
        className="w-full px-4 py-3 text-left text-[15px] font-semibold text-red-500 hover:bg-gray-50">
        Delete Post
      </button>
    </div>
  );
};

const ViewerHeader = ({ post, onClose, onProfile, showMore, setShowMore, isOwn, onDelete, onPrivacy }) => (
  <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-20 pt-[max(16px,env(safe-area-inset-top))]">
    <div className="flex items-center gap-3">
      <button type="button" onClick={onClose} className="p-2 -ml-2 rounded-full bg-black/20 backdrop-blur hover:bg-black/40">
        <ArrowLeft size={24} color="#fff" />
      </button>
      <button type="button" className="flex items-center gap-2" onClick={onProfile}>
        {post.creator?.avatarUrl ? (
          <img src={post.creator.avatarUrl} className="w-9 h-9 rounded-full object-cover border border-white/20" alt="" />
        ) : (
          <DefaultAvatar size={36} />
        )}
        <div className="flex flex-col text-left">
          <span className="text-[15px] font-bold text-white leading-tight">
            {post.creator?.displayName || post.creator?.username || 'User'}
          </span>
          <span className="text-[12px] text-white/80">
            <PostTimestamp createdAt={post.created_at || post.createdAt} />
          </span>
        </div>
      </button>
    </div>
    <div className="relative">
      <button type="button" onClick={(e) => { e.stopPropagation(); setShowMore(!showMore); }}
        className="p-2 rounded-full bg-black/20 backdrop-blur hover:bg-black/40">
        <MoreVertical size={24} color="#fff" />
      </button>
      {showMore && (
        <MoreMenuDropdown post={post} isOwn={isOwn} onClose={() => setShowMore(false)} onDelete={onDelete} onPrivacy={onPrivacy} />
      )}
    </div>
  </div>
);

/* ── Base White Viewer (Image/Carousel/Text) ── */
const BaseWhiteViewer = ({ post, viewerPosts, selectedPostId, onNavigate, onClose, isOwn, onDelete, onEngagement, onPrivacy, children, title }) => {
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const [expandedCaptions, setExpandedCaptions] = useState({});
  const caption = post.content?.caption || post.caption || post.content?.text || post.text_content || '';
  const currentIdx = viewerPosts.findIndex((p) => String(p.id) === String(selectedPostId));
  const privacy = normalizePrivacy(post);

  const handleTagClick = (tag) => { onClose(); navigate(`/tag/${tag}`); };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => { if (currentIdx < viewerPosts.length - 1) onNavigate(viewerPosts[currentIdx + 1].id); },
    onSwipedRight: () => { if (currentIdx > 0) onNavigate(viewerPosts[currentIdx - 1].id); },
    preventScrollOnSwipe: false,
    trackMouse: true
  });

  return (
    <div {...swipeHandlers} className="fixed inset-0 z-[9999] bg-[#F7F7F9] flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between p-4 border-b border-[#E8E8EC] bg-white pt-[max(16px,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-[#F7F7F9]">
          <X size={24} color="#111" />
        </button>
        <span className="text-[15px] font-semibold text-[#111111]">{title}</span>
        <div className="relative w-10">
          <button type="button" onClick={() => setShowMore(!showMore)} className="p-2 rounded-full hover:bg-[#F7F7F9]">
            <MoreVertical size={22} color="#111" />
          </button>
          {showMore && (
            <MoreMenuDropdown post={post} isOwn={isOwn} onClose={() => setShowMore(false)} onDelete={onDelete} onPrivacy={onPrivacy} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        <div className="w-full max-w-lg mx-auto bg-white rounded-2xl border border-[#E8E8EC] overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center gap-3 p-4">
            <button type="button" onClick={() => { onClose(); navigate(`/profile/${post.creator?.id || post.user_id}`); }}>
              <DefaultAvatar size={40} src={post.creator?.avatarUrl} />
            </button>
            <div className="flex-1">
              <button type="button" onClick={() => { onClose(); navigate(`/profile/${post.creator?.id || post.user_id}`); }} className="font-semibold text-[#111111] hover:underline text-left">
                {post.creator?.displayName || post.creator?.username || 'User'}
              </button>
              <p className="text-[13px] text-[#666666]">
                <PostTimestamp createdAt={post.created_at || post.createdAt} />
              </p>
            </div>
            {post.content?.audio && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F7F7F9] rounded-full text-[12px] font-medium text-[#111111]">
                <Music size={14} />
                <span className="max-w-[100px] truncate">{post.content.audio}</span>
              </div>
            )}
          </div>
          
          {children && (
            <div className="w-full relative flex items-center justify-center bg-[#F7F7F9]">
              {children}
            </div>
          )}

          <div className="p-4 border-t border-[#E8E8EC]">
            {caption && (
              <p className="text-[#111111] text-[15px] leading-relaxed whitespace-pre-wrap mb-4">
                <CaptionText text={caption} postId={post.id} onTagClick={handleTagClick}
                  expandedCaptions={expandedCaptions} setExpandedCaptions={setExpandedCaptions} light />
              </p>
            )}

            <div className="w-full">
              <PostActions 
                post={post}
                onRespect={() => onEngagement('respect')}
                onComment={() => onEngagement('comment')}
                onShare={() => onEngagement('share')}
                onSave={() => onEngagement('save')}
              />
            </div>
            {privacy.commentsEnabled === false && (
              <p className="mt-3 text-center text-[#666666] text-[13px]">Comments are turned off</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Image Viewer ── */
const ImageViewer = (props) => {
  const mediaUrl = getPostMediaUrl(props.post);
  return (
    <BaseWhiteViewer {...props} title="Image">
      <img src={mediaUrl} alt="" className="w-full max-h-[50vh] object-contain" />
    </BaseWhiteViewer>
  );
};

/* ── Carousel Viewer ── */
const CarouselViewer = (props) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const images = getCarouselImages(props.post);
  
  useEffect(() => { setSlideIdx(0); }, [props.post.id]);

  return (
    <BaseWhiteViewer {...props} title="Carousel">
      <div className="w-full max-h-[50vh] flex items-center justify-center relative">
        {slideIdx > 0 && (
          <button type="button" onClick={() => setSlideIdx((i) => i - 1)}
            className="absolute left-2 z-10 p-2 rounded-full bg-white/80 shadow text-black">
            <ChevronLeft size={20} />
          </button>
        )}
        <img src={images[slideIdx]} alt="" className="max-w-full max-h-full object-contain" />
        {slideIdx < images.length - 1 && (
          <button type="button" onClick={() => setSlideIdx((i) => i + 1)}
            className="absolute right-2 z-10 p-2 rounded-full bg-white/80 shadow text-black">
            <ChevronRight size={20} />
          </button>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 px-2 py-1 rounded-full">
            {images.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === slideIdx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        )}
      </div>
    </BaseWhiteViewer>
  );
};

/* ── Text Viewer ── */
const TextViewer = (props) => {
  return (
    <BaseWhiteViewer {...props} title="Text Post" />
  );
};

/* ── Reel Viewer (vertical swipe, video only) ── */
const ReelViewer = ({ viewerPosts, selectedPostId, onNavigate, onClose, isOwn, onDelete, onEngagement, onPrivacy }) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, viewerPosts.findIndex((p) => String(p.id) === String(selectedPostId)))
  );
  const [showMore, setShowMore] = useState(false);
  const [expandedCaptions, setExpandedCaptions] = useState({});

  const currentPost = viewerPosts[currentIndex];

  useEffect(() => {
    const idx = viewerPosts.findIndex((p) => String(p.id) === String(selectedPostId));
    if (idx >= 0) setCurrentIndex(idx);
  }, [selectedPostId, viewerPosts]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: currentIndex * window.innerHeight, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(containerRef.current.scrollTop / window.innerHeight);
    if (idx !== currentIndex && idx >= 0 && idx < viewerPosts.length) {
      setCurrentIndex(idx);
      onNavigate(viewerPosts[idx].id);
    }
  };

  const handleTagClick = (tag) => { onClose(); navigate(`/tag/${tag}`); };

  if (!currentPost) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black" style={{ height: '100dvh' }}>
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
      >
        {viewerPosts.map((post, i) => {
          const isCurrent = i === currentIndex;
          const isVisible = Math.abs(i - currentIndex) <= 1;
          const mediaUrl = post.content?.videoUrl || post.videoUrl;
          const caption = post.content?.caption || post.caption || post.content?.text || post.text_content || '';

          return (
            <div key={post.id} className="w-full snap-start relative flex items-center justify-center bg-black"
              style={{ height: '100dvh' }}>
              {isVisible && (
                <>
                  <video
                    src={mediaUrl}
                    autoPlay={isCurrent}
                    loop
                    playsInline
                    muted={false}
                    className="w-full h-full object-contain"
                  />
                  {isCurrent && (
                    <>
                      <ViewerHeader
                        post={post} onClose={onClose} showMore={showMore} setShowMore={setShowMore}
                        isOwn={isOwn} onDelete={onDelete} onPrivacy={onPrivacy}
                        onProfile={() => { onClose(); navigate(`/profile/${post.creator?.id || post.user_id}`); }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-4 pb-[max(16px,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between z-10">
                        <div className="flex-1 pr-12">
                          {caption && (
                            <p className="text-white text-[15px] leading-snug mb-2">
                              <CaptionText text={caption} postId={post.id} onTagClick={handleTagClick}
                                expandedCaptions={expandedCaptions} setExpandedCaptions={setExpandedCaptions} />
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-white/90 text-[13px] font-medium">
                            <Music size={14} />
                            <span>{post.content?.audio || 'Original Audio'}</span>
                          </div>
                        </div>
                          <RightActionBar
                            post={post}
                            respected={normalizeEngagement(post).hasRespected}
                            saved={normalizeEngagement(post).hasSaved}
                            liveRespects={normalizeEngagement(post).respectCount}
                            commentCount={normalizeEngagement(post).commentCount}
                            shareCount={normalizeEngagement(post).shareCount}
                            paused={false}
                            onRespect={() => onEngagement(post.id, 'respect')}
                            onComment={() => onEngagement(post.id, 'comment')}
                            onShare={() => onEngagement(post.id, 'share')}
                            onSave={() => onEngagement(post.id, 'save')}
                          />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Main ProfileContentViewer ── */
export const ProfileContentViewer = ({
  posts,
  selectedPostId,
  tab = 'images',
  onClose,
  isOwn,
  onDelete,
  onEngagement,
  onNavigate,
}) => {
  // Context methods removed - engagement is handled via onEngagement callback prop

  const viewerPosts = useMemo(() => {
    return posts.filter((post) => {
      const type = determineContentType(post);
      if (tab === 'reels') return type === 'video';
      if (tab === 'text') return type === 'text';
      if (tab === 'images') return type === 'image' || type === 'carousel';
      if (tab === 'featured') return post.isFeatured || post.is_featured;
      return true;
    });
  }, [posts, tab]);

  const currentPost = useMemo(() => {
    return viewerPosts.find((p) => String(p.id) === String(selectedPostId));
  }, [viewerPosts, selectedPostId]);

  const handleEngagement = useCallback(async (postId, action) => {
    if (onEngagement) onEngagement(postId, action);
  }, [onEngagement]);

  const handlePrivacy = useCallback((postId, field, val) => {
    const fieldMap = {
      privacy_respect: 'hideRespectCount',
      privacy_share: 'hideShareCount',
      privacy_comments: 'commentsEnabled',
      privacy_reuse: 'reuseEnabled',
    };
    const key = fieldMap[field] || field;
    if (onEngagement) onEngagement(postId, field, val);

    fetch(`/api/posts/${postId}/privacy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        },
      body: JSON.stringify({ [key]: val }),
    }).catch(console.error);
  }, [onEngagement]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!currentPost) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <p className="text-white">Post not found</p>
        <button type="button" onClick={onClose} className="ml-4 text-[#6366F1]">Close</button>
      </div>
    );
  }

  const contentType = determineContentType(currentPost);
  const navProps = {
    post: currentPost,
    viewerPosts,
    selectedPostId,
    onNavigate: onNavigate || (() => {}),
    onClose,
    isOwn,
    onDelete,
    onPrivacy: (field, val) => handlePrivacy(currentPost.id, field, val),
    onEngagement: (action) => handleEngagement(currentPost.id, action),
  };

  if (contentType === 'video') {
    return (
      <ReelViewer
        viewerPosts={viewerPosts}
        selectedPostId={selectedPostId}
        onNavigate={onNavigate}
        onClose={onClose}
        isOwn={isOwn}
        onDelete={onDelete}
        onEngagement={handleEngagement}
        onPrivacy={(field, val) => handlePrivacy(currentPost.id, field, val)}
      />
    );
  }

  if (contentType === 'carousel') {
    return <CarouselViewer {...navProps} />;
  }

  if (contentType === 'text') {
    return <TextViewer {...navProps} />;
  }

  return <ImageViewer {...navProps} />;
};

export default ProfileContentViewer;
