import React, { useState, useContext, useCallback, useMemo } from 'react';
import { useRelativeTime } from '../../hooks/useRelativeTime';
import { MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/UserContext';
import DefaultAvatar from '../DefaultAvatar';
import { motion } from 'framer-motion';

export const FeedCreatorHeader = ({ post, onFollow, onMore }) => {
  const navigate = useNavigate();
  const { creator, metadata } = post || {};
  
  const { followUser, unfollowUser, user } = useContext(UserContext) || {};
  
  // Derive follow state from global UserContext
  const isFollowing = useMemo(() => {
    return (user?.following || []).includes(creator?.id);
  }, [user?.following, creator?.id]);
  
  const [isFollowingPending, setIsFollowingPending] = useState(false);
  const [error, setError] = useState(false);

  const isOwnPost = user?.id === creator?.id;

  const handleToggleFollow = useCallback(async (e) => {
    e?.stopPropagation();
    
    if (isFollowingPending || !creator?.id) return;
    
    setIsFollowingPending(true);
    setError(false);
    
    try {
      // Simulate network request if no backend exists, matching Profile.jsx behavior
      await new Promise(r => setTimeout(r, 600));
      
      if (isFollowing) {
        unfollowUser && unfollowUser(creator.id);
      } else {
        followUser && followUser(creator.id);
        if (onFollow) onFollow(creator.id);
      }
    } catch (err) {
      console.error('Follow error:', err);
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setIsFollowingPending(false);
    }
  }, [isFollowing, isFollowingPending, creator?.id, onFollow, followUser, unfollowUser]);

  const handleNavigateToProfile = useCallback(() => {
    if (creator?.id || creator?.username) {
      navigate(`/profile/${creator?.id || creator?.username}`);
    }
  }, [navigate, creator?.id, creator?.username]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigateToProfile();
    }
  }, [handleNavigateToProfile]);

  const creatorName = useMemo(() => {
    return creator?.displayName || creator?.username || 'User';
  }, [creator]);

  const creatorUsername = useMemo(() => {
    return creator?.username || 'user';
  }, [creator]);



  const isVerified = creator?.isVerified === true;
  const isLocal = metadata?.context === 'local';
  const isForYou = metadata?.context === 'for_you';

  const relativeTime = useRelativeTime(post?.created_at || post?.createdAt);

  return (
    <div 
      className="w-full py-2.5 sm:py-3 flex items-start justify-between z-10 relative px-1"
      role="banner"
      aria-label={`Post by ${creatorName}`}
    >
      <div 
        className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group" 
        onClick={handleNavigateToProfile}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`View profile of ${creatorName}`}
      >
        {/* Avatar */}
        <DefaultAvatar
          size={44}
          src={creator?.avatarUrl || creator?.profile_pic}
          creatorId={creator?.id}
          creatorName={creatorName}
          className="flex-shrink-0 group-hover:ring-2 group-hover:ring-[#7F77DD]/50 transition-all focus:outline-none"
        />
        
        {/* Name & Username & Follow */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[#111111] font-bold text-[14px] sm:text-[15px] leading-tight tracking-tight truncate max-w-[150px] sm:max-w-none">
              {creatorName}
            </span>
            {isVerified && (
              <span className="text-[#7F77DD] mt-0.5 flex-shrink-0" aria-label="Verified">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </span>
            )}
            
            {/* Follow Button next to username */}
            {!isOwnPost && (
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleFollow}
                disabled={isFollowingPending}
                className={`ml-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all focus:outline-none focus:ring-1 focus:ring-[#7F77DD]/50 relative before:absolute before:-inset-2 before:content-[''] ${
                  isFollowing 
                    ? 'bg-transparent text-[#666666] border border-[#E8E8EC] hover:bg-black/5' 
                    : 'bg-[#7F77DD] text-white hover:bg-[#7F77DD]/90'
                } ${isFollowingPending ? 'opacity-70 cursor-not-allowed' : ''}`}
                aria-pressed={isFollowing}
                aria-label={isFollowing ? `Unfollow ${creatorName}` : `Follow ${creatorName}`}
              >
                {isFollowingPending ? '...' : isFollowing ? 'Following' : 'Follow'}
              </motion.button>
            )}
          </div>
          <div className="text-[#8A8A8F] text-[12px] sm:text-[13px] font-medium mt-0.5 truncate">
            @{creatorUsername} {relativeTime ? `· ${relativeTime}` : ''}
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Context Badges */}
        {isLocal && (
          <div 
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/5 border border-black/10"
            aria-label="Local creator"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-medium text-[#666666]">Local</span>
          </div>
        )}
        {isForYou && (
          <div 
            className="bg-[#7F77DD]/20 text-[#7F77DD] text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-md hidden xs:block"
            aria-label="For you content"
          >
            For You
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <span className="text-red-500 text-[10px] sm:text-[11px] font-medium mr-1" role="alert">
            Failed
          </span>
        )}
        
        {/* More Menu Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onMore?.(post.id, post.creator?.id);
          }}
          className="p-1.5 sm:p-2 text-[#8A8A8F] hover:text-[#111111] hover:bg-black/5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 relative before:absolute before:-inset-2 before:content-['']"
          aria-label="More options"
        >
          <MoreHorizontal size={18} strokeWidth={2} className="sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
};

export default FeedCreatorHeader;