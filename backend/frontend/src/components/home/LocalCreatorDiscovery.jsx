import React, { useState, useCallback, useMemo } from 'react';
import { MapPin, UserPlus, Check, Sparkles } from 'lucide-react';
import DefaultAvatar from '../DefaultAvatar';

export const LocalCreatorDiscovery = ({ creator: initialCreator, onClose }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  // Provide fallback demo data if no creator prop is passed
  const displayCreator = useMemo(() => initialCreator || {
    id: 'local_1',
    displayName: 'Aravind',
    username: 'aravind_tech',
    avatarUrl: null,
    topics: ['Technology', 'Local culture'],
  }, [initialCreator]);

  const handleFollow = useCallback(() => {
    if (isPending) return; // Prevent double clicks
    
    setIsPending(true);
    setIsFollowing(!isFollowing);
    
    // Simulate API call
    setTimeout(() => {
      setIsPending(false);
    }, 500);
  }, [isFollowing, isPending]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFollow();
    }
  }, [handleFollow]);

  const creatorName = useMemo(() => {
    return displayCreator.displayName || 'Local Creator';
  }, [displayCreator]);

  const creatorUsername = useMemo(() => {
    return displayCreator.username || 'user';
  }, [displayCreator]);

  const creatorTopics = useMemo(() => {
    return displayCreator.topics?.join(' · ') || 'Local Community';
  }, [displayCreator]);



  return (
    <div 
      className="w-full bg-[#F7F7F9] flex flex-col justify-center px-4 sm:px-6 py-8 sm:py-10 relative overflow-hidden my-3 sm:my-4 border-y border-[#E8E8EC]"
      role="region"
      aria-label="Local creator discovery"
    >
      <div className="w-full max-w-[400px] mx-auto z-10 flex flex-col items-center text-center bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl sm:rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[1px] bg-gradient-to-r from-transparent via-[#7F77DD]/30 to-transparent" aria-hidden="true" />
        
        {/* Header */}
        <div className="flex items-center gap-2 mb-5 sm:mb-6" role="banner">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#7F77DD]/15 flex items-center justify-center">
            <MapPin size={12} className="text-[#7F77DD]" strokeWidth={2.5} />
          </div>
          <span className="text-[#7F77DD] text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase">
            Discover Locally
          </span>
        </div>
        
        {/* Avatar */}
        <DefaultAvatar 
          size={64}
          src={displayCreator.avatarUrl}
          creatorName={creatorName}
          className="border-2 border-[#FFFFFF] shadow-sm mb-3"
        />
        
        {/* Name */}
        <h3 className="text-[#111111] text-[18px] sm:text-[20px] font-bold tracking-tight mb-1">
          {creatorName}
        </h3>
        <span className="text-[#8A8A8F] text-[13px] sm:text-[14px] mb-5 sm:mb-6">
          @{creatorUsername}
        </span>
        
        {/* Topics */}
        <div className="flex flex-col items-center gap-1.5 mb-6 sm:mb-8">
          <span className="text-[#8A8A8F] text-[11px] sm:text-[12px] font-medium tracking-wide uppercase">
            Creates content about
          </span>
          <span className="text-[#666666] text-[13px] sm:text-[14px] font-medium">
            {creatorTopics}
          </span>
        </div>
        
        {/* Follow Button */}
        <button 
          onClick={handleFollow}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-[13px] sm:text-[14px] font-bold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 flex items-center gap-2 min-h-[44px] ${
            isFollowing 
              ? 'bg-[#E8E8EC] text-[#666666] hover:bg-[#E8E8EC]/80' 
              : 'bg-[#7F77DD] text-white hover:bg-[#7F77DD]/90 shadow-[0_0_20px_rgba(127,119,221,0.3)]'
          } ${isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
          aria-pressed={isFollowing}
          aria-label={isFollowing ? `Following ${creatorName}` : `Follow ${creatorName}`}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </span>
          ) : isFollowing ? (
            <span className="flex items-center gap-2">
              <Check size={16} strokeWidth={2.5} />
              Following
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <UserPlus size={16} strokeWidth={2.5} />
              Follow
            </span>
          )}
        </button>
        
        {/* Decorative Sparkles */}
        <div className="flex items-center gap-1 mt-4 sm:mt-5" aria-hidden="true">
          <Sparkles size={10} className="text-[#7F77DD]/30" strokeWidth={2} />
          <Sparkles size={8} className="text-[#7F77DD]/20" strokeWidth={2} />
          <Sparkles size={10} className="text-[#7F77DD]/30" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
};

export default LocalCreatorDiscovery;