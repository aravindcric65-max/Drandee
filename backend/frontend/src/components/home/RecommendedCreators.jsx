import React, { useState, useCallback, useMemo } from 'react';
import { Sparkles, UserPlus, Check } from 'lucide-react';

export const RecommendedCreators = ({ mode = 'global' }) => {
  const [following, setFollowing] = useState({});

  const creators = useMemo(() => [
    { name: 'Alex Rivera', username: '@arivera', avatar: '1', reason: 'Popular around you' },
    { name: 'Sarah Chen', username: '@schen', avatar: '2', reason: 'Because you follow Tech' },
    { name: 'Mike Ross', username: '@mross', avatar: '3', reason: 'Trending creator' }
  ], []);

  const handleFollow = useCallback((creatorName) => {
    setFollowing(prev => ({
      ...prev,
      [creatorName]: !prev[creatorName]
    }));
  }, []);

  const handleKeyDown = useCallback((e, creatorName) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFollow(creatorName);
    }
  }, [handleFollow]);

  const isFollowing = useCallback((creatorName) => {
    return following[creatorName] || false;
  }, [following]);

  return (
    <div 
      className="w-full bg-[#FFFFFF] flex flex-col justify-center px-4 sm:px-6 py-8 sm:py-10 relative overflow-hidden my-3 sm:my-4 border-y border-[#E8E8EC]"
      role="region"
      aria-label="Recommended creators"
    >
      <div className="w-full max-w-[600px] mx-auto z-10">
        
        {/* Header */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-5 sm:mb-6" role="banner">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD] border border-[#7F77DD]/20">
            <Sparkles size={14} strokeWidth={2} />
          </div>
          <span className="text-[#7F77DD] text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase">
            Recommended Creators
          </span>
        </div>

        {/* Creators List */}
        <div 
          className="flex overflow-x-auto gap-3 sm:gap-4 pb-4 snap-x hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
          role="list"
          aria-label="Creator recommendations"
        >
          {creators.map((creator, i) => {
            const creatorFollowing = isFollowing(creator.name);
            
            return (
              <div 
                key={i} 
                className="min-w-[150px] sm:min-w-[160px] max-w-[150px] sm:max-w-[160px] flex flex-col items-center p-3.5 sm:p-4 rounded-2xl bg-[#F7F7F9] border border-[#E8E8EC] snap-start focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30"
                role="listitem"
                tabIndex={0}
              >
                {/* Avatar */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#7F77DD]/20 overflow-hidden mb-3 border border-[#7F77DD]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#7F77DD] font-bold text-xl sm:text-2xl" aria-hidden="true">
                    {creator.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                
                {/* Name */}
                <h3 className="text-[#111111] font-bold text-[13px] sm:text-[14px] text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full mb-0.5">
                  {creator.name}
                </h3>
                
                {/* Username */}
                <span className="text-[#8A8A8F] text-[11px] sm:text-[12px] mb-3">
                  {creator.username}
                </span>
                
                {/* Reason */}
                <p className="text-[#666666] text-[10px] sm:text-[11px] font-medium text-center mb-4 h-8 sm:h-10 flex items-center justify-center leading-tight line-clamp-2">
                  {creator.reason}
                </p>
                
                {/* Follow Button */}
                <button 
                  onClick={() => handleFollow(creator.name)}
                  onKeyDown={(e) => handleKeyDown(e, creator.name)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-[12px] font-bold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 w-full justify-center min-h-[36px] ${
                    creatorFollowing 
                      ? 'bg-[#E8E8EC] text-[#666666] hover:bg-[#E8E8EC]/80' 
                      : 'bg-[#7F77DD] text-white hover:bg-[#7F77DD]/90'
                  }`}
                  aria-pressed={creatorFollowing}
                  aria-label={creatorFollowing ? `Following ${creator.name}` : `Follow ${creator.name}`}
                >
                  {creatorFollowing ? (
                    <>
                      <Check size={12} strokeWidth={2.5} />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus size={12} strokeWidth={2} />
                      Follow
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RecommendedCreators;