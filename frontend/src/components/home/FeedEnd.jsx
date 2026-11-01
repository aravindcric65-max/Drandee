import React from 'react';
import { CheckCircle2, Sparkles, RefreshCcw } from 'lucide-react';

export const FeedEnd = () => {
  return (
    <div 
      className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-black to-white/[0.01] py-12 sm:py-16 text-center border-t border-white/[0.03]"
      role="status"
      aria-label="End of feed"
    >
      {/* Icon Container */}
      <div 
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#7F77DD]/10 to-white/[0.02] flex items-center justify-center mb-4 sm:mb-5 border border-white/10 shadow-lg"
        aria-hidden="true"
      >
        <CheckCircle2 
          size={18} 
          className="text-[#7F77DD]/60" 
          strokeWidth={2}
        />
      </div>
      
      {/* Title */}
      <h3 className="text-white/60 text-[13px] sm:text-[14px] font-medium mb-1.5 sm:mb-2 tracking-tight">
        You're all caught up!
      </h3>
      
      {/* Subtitle */}
      <p className="text-white/40 text-[11px] sm:text-[12px] font-normal max-w-[240px] sm:max-w-[260px] leading-relaxed">
        You've seen all the latest posts. Check back soon for more!
      </p>
      
      {/* Decorative Sparkles */}
      <div 
        className="flex items-center gap-1 mt-4 sm:mt-5"
        aria-hidden="true"
      >
        <Sparkles size={10} className="text-[#7F77DD]/40" strokeWidth={2} />
        <Sparkles size={8} className="text-[#7F77DD]/30" strokeWidth={2} />
        <Sparkles size={10} className="text-[#7F77DD]/40" strokeWidth={2} />
      </div>
      
      {/* Optional Refresh Hint */}
      <div className="flex items-center gap-2 mt-5 sm:mt-6 text-white/30 text-[10px] sm:text-[11px] font-medium">
        <RefreshCcw size={10} strokeWidth={2} />
        <span>Pull to refresh</span>
      </div>
    </div>
  );
};

export default FeedEnd;