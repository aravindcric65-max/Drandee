import React, { useMemo, useCallback } from 'react';
import { TrendingUp, MapPin, Sparkles } from 'lucide-react';

export const TrendingTopics = ({ mode = 'global' }) => {
  const isLocal = useMemo(() => mode === 'local', [mode]);

  const topics = useMemo(() => [
    '#AI', '#CollegeLife', '#Photography', '#Music', '#Technology', '#LocalFood'
  ], []);

  const handleTopicClick = useCallback((topic) => {
    // Navigate to topic page
    window.location.href = `/explore?tag=${encodeURIComponent(topic)}`;
  }, []);

  const handleKeyDown = useCallback((e, topic) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTopicClick(topic);
    }
  }, [handleTopicClick]);

  return (
    <div 
      className="w-full bg-black flex flex-col justify-center px-4 sm:px-6 py-6 sm:py-8 relative overflow-hidden my-2 sm:my-3 border-y border-white/[0.05]"
      role="region"
      aria-label="Trending topics"
    >
      <div className="w-full max-w-[600px] mx-auto z-10">
        {/* Header */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5" role="banner">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD] border border-[#7F77DD]/20">
            {isLocal ? (
              <MapPin size={14} strokeWidth={2.5} />
            ) : (
              <TrendingUp size={14} strokeWidth={2.5} />
            )}
          </div>
          <span className="text-[#7F77DD] text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase">
            {isLocal ? 'Trending Around You' : 'Trending Now'}
          </span>
        </div>

        {/* Topics Grid */}
        <div 
          className="flex flex-wrap gap-2 sm:gap-2.5"
          role="list"
          aria-label="Trending topics list"
        >
          {topics.map((topic, i) => (
            <button 
              key={i}
              onClick={() => handleTopicClick(topic)}
              onKeyDown={(e) => handleKeyDown(e, topic)}
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-white/70 text-[12px] sm:text-[13px] font-medium hover:bg-white/10 hover:text-white hover:border-white/15 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30 min-h-[36px]"
              role="listitem"
              aria-label={`View trending topic: ${topic}`}
            >
              {topic}
            </button>
          ))}
        </div>

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

export default TrendingTopics;