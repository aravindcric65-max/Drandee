import React, { useState, useContext, useCallback, useMemo } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/UserContext';
import DefaultAvatar from '../DefaultAvatar';

export const FeedCreatorHeader = ({ post, onFollow, onMore }) => {
  const navigate = useNavigate();
  const { creator, metadata } = post || {};
  
  const { token, followUser, unfollowUser, user } = useContext(UserContext) || {};
  
  // Optimistic Follow State
  const [isFollowing, setIsFollowing] = useState(post.userInteraction?.isFollowing || false);
  const [isFollowingPending, setIsFollowingPending] = useState(false);
  const [error, setError] = useState(false);

  const isOwnPost = user?.id === creator?.id;

  const handleToggleFollow = useCallback(async (e) => {
    e?.stopPropagation();
    
    if (isFollowingPending) return; // Prevent double clicks
    
    const originalState = isFollowing;
    const newState = !originalState;
    
    // Optimistic update
    setIsFollowing(newState);
    setIsFollowingPending(true);
    setError(false);
    
    try {
      const authToken = token || localStorage.getItem('token');
      const res = await fetch(`/api/user/follow/${creator?.id}`, {
        method: newState ? 'POST' : 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('API failed');
      }
      
      // Call parent callback if provided
      if (newState && onFollow) {
        onFollow(creator?.id);
      }
    } catch (err) {
      console.error('Follow error:', err);
      // Revert gracefully on failure
      setIsFollowing(originalState);
      setError(true);
      
      if (originalState) {
        followUser?.(creator?.id);
      } else {
        unfollowUser?.(creator?.id);
      }
      
      setTimeout(() => setError(false), 3000);
    } finally {
      setIsFollowingPending(false);
    }
  }, [isFollowing, isFollowingPending, token, creator?.id, onFollow, followUser, unfollowUser]);

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
            <span className="text-white font-bold text-[14px] sm:text-[15px] leading-tight tracking-tight truncate max-w-[150px] sm:max-w-none">
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
              <button 
                onClick={handleToggleFollow}
                disabled={isFollowingPending}
                className={`ml-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all focus:outline-none focus:ring-1 focus:ring-[#7F77DD]/50 ${
                  isFollowing 
                    ? 'bg-transparent text-white/50 border border-white/20 hover:bg-white/5' 
                    : 'bg-[#7F77DD] text-white hover:bg-[#7F77DD]/90'
                } ${isFollowingPending ? 'opacity-70 cursor-not-allowed' : ''}`}
                aria-pressed={isFollowing}
                aria-label={isFollowing ? `Following ${creatorName}` : `Follow ${creatorName}`}
              >
                {isFollowingPending ? '...' : isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          <div className="text-white/50 text-[12px] sm:text-[13px] font-medium mt-0.5 truncate">
            @{creatorUsername} · 2h
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Context Badges */}
        {isLocal && (
          <div 
            className="bg-white/10 text-white/70 text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-md hidden xs:block"
            aria-label="Local content"
          >
            Local
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
          <span className="text-red-400 text-[10px] sm:text-[11px] font-medium mr-1" role="alert">
            Failed
          </span>
        )}
        
        {/* More Menu Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onMore?.(post.id);
          }}
          className="p-1.5 sm:p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50"
          aria-label="More options"
        >
          <MoreHorizontal size={18} strokeWidth={2} className="sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
};

export default FeedCreatorHeader;