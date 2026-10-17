import React, { useMemo, useCallback } from 'react';
import { Compass, Users, MapPin, Sparkles } from 'lucide-react';

export const FeedEmpty = ({ mode = 'for_you', onExplore }) => {
  const content = useMemo(() => ({
    for_you: {
      icon: <Compass className="w-10 h-10 sm:w-12 sm:h-12 text-[#7F77DD]" strokeWidth={1.5} />,
      title: "Your feed is quiet.",
      text: "Explore something new or follow creators to fill your feed.",
      btn: "Explore",
      bgGradient: "from-[#7F77DD]/20 to-[#7F77DD]/5"
    },
    following: {
      icon: <Users className="w-10 h-10 sm:w-12 sm:h-12 text-[#7F77DD]" strokeWidth={1.5} />,
      title: "You're not following anyone yet.",
      text: "Discover creators and follow the people you want to see here.",
      btn: "Find Creators",
      bgGradient: "from-[#7F77DD]/20 to-[#7F77DD]/5"
    },
    local: {
      icon: <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-[#7F77DD]" strokeWidth={1.5} />,
      title: "Nothing interesting nearby yet.",
      text: "We're looking for fresh content around your area.",
      btn: "Explore Global",
      bgGradient: "from-[#7F77DD]/20 to-[#7F77DD]/5"
    }
  }), []);

  const { icon, title, text, btn, bgGradient } = content[mode] || content.for_you;

  const handleExplore = useCallback(() => {
    if (onExplore) {
      onExplore(mode);
    } else {
      // Default navigation based on mode
      switch (mode) {
        case 'following':
          window.location.href = '/discover';
          break;
        case 'local':
          window.location.href = '/explore?tab=global';
          break;
        default:
          window.location.href = '/explore';
      }
    }
  }, [onExplore, mode]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleExplore();
    }
  }, [handleExplore]);

  return (
    <div 
      className="w-full h-full flex-1 flex flex-col justify-center items-center px-6 sm:px-8 py-12 sm:py-16 text-center bg-gradient-to-b from-white/[0.02] to-transparent"
      role="status"
      aria-label="No content available"
    >
      {/* Icon Container */}
      <div 
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br ${bgGradient} flex items-center justify-center mb-6 sm:mb-8 border border-white/10 shadow-lg`}
        aria-hidden="true"
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#7F77DD]/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
      
      {/* Title */}
      <h2 className="text-white text-[18px] sm:text-[20px] md:text-[22px] font-bold mb-2.5 sm:mb-3 tracking-tight leading-tight">
        {title}
      </h2>
      
      {/* Description */}
      <p className="text-white/50 mb-8 sm:mb-10 max-w-[260px] sm:max-w-[280px] text-[13px] sm:text-[14px] md:text-[15px] leading-relaxed">
        {text}
      </p>
      
      {/* Primary CTA */}
      <button 
        onClick={handleExplore}
        onKeyDown={handleKeyDown}
        className="group px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-[#7F77DD] text-white font-bold text-[13px] sm:text-[14px] hover:bg-[#7F77DD]/90 active:bg-[#7F77DD]/80 transition-all active:scale-95 shadow-[0_0_20px_rgba(127,119,221,0.3)] hover:shadow-[0_0_25px_rgba(127,119,221,0.4)] focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 min-h-[44px] min-w-[120px]"
        aria-label={btn}
      >
        <span className="flex items-center gap-2">
          {btn}
          <Sparkles 
            size={14} 
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
            strokeWidth={2}
          />
        </span>
      </button>
      
      {/* Secondary hint */}
      <p className="text-white/30 text-[11px] sm:text-[12px] mt-6 sm:mt-8 font-medium">
        {mode === 'for_you' && 'Tip: Follow creators you like to see more content'}
        {mode === 'following' && 'Tip: Browse trending creators to get started'}
        {mode === 'local' && 'Tip: Enable location to see nearby content'}
      </p>
    </div>
  );
};

export default FeedEmpty;