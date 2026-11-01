import React, { useCallback } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export const FeedError = ({ onRetry }) => {
  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRetry();
    }
  }, [handleRetry]);

  return (
    <div 
      className="w-full min-h-[60vh] sm:min-h-[70vh] flex flex-col justify-center items-center px-6 sm:px-8 py-12 sm:py-16 text-center bg-transparent"
      role="alert"
      aria-label="Error loading feed"
    >
      {/* Error Icon */}
      <div 
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-5 sm:mb-6 border border-red-500/20 shadow-lg"
        aria-hidden="true"
      >
        <AlertCircle 
          size={28} 
          className="text-red-400" 
          strokeWidth={2}
        />
      </div>
      
      {/* Title */}
      <h2 className="text-[#111111] text-[16px] sm:text-[17px] md:text-[18px] font-semibold mb-2 sm:mb-2.5 tracking-tight leading-tight">
        Couldn't load your feed
      </h2>
      
      {/* Description */}
      <p className="text-[#666666] mb-6 sm:mb-8 max-w-[260px] sm:max-w-[280px] text-[12px] sm:text-[13px] leading-relaxed">
        Something went wrong. Don't worry, we're on it. Try again!
      </p>
      
      {/* Retry Button */}
      <button 
        onClick={handleRetry}
        onKeyDown={handleKeyDown}
        className="group px-6 sm:px-7 py-2.5 sm:py-3 rounded-full bg-[#E8E8EC] border border-[#E8E8EC] text-[#111111] font-semibold text-[13px] sm:text-[14px] hover:bg-black/10 transition-all active:scale-95 focus:outline-none min-h-[40px] min-w-[100px]"
        aria-label="Retry loading feed"
      >
        <span className="flex items-center gap-2">
          <RefreshCcw 
            size={14} 
            className="group-hover:rotate-180 transition-transform duration-500" 
            strokeWidth={2}
          />
          Retry
        </span>
      </button>
      
      {/* Helper Text */}
      <p className="text-[#8A8A8F] text-[10px] sm:text-[11px] mt-5 sm:mt-6 font-medium">
        If this keeps happening, check your connection
      </p>
    </div>
  );
};

export default FeedError;