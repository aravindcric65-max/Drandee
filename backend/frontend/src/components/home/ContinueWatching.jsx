import React, { useState, useCallback, useMemo } from 'react';
import { PlayCircle, Play, X } from 'lucide-react';

export const ContinueWatching = () => {
  const [sessions, setSessions] = useState([
    { 
      id: 1, 
      title: 'Building the new Drandee Engine', 
      creator: '@aravind', 
      creatorId: 'aravind',
      progress: 65, 
      thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=150&q=80',
      videoId: 'vid_123'
    },
    { 
      id: 2, 
      title: 'Local Coffee Shop Tour', 
      creator: '@sarah', 
      creatorId: 'sarah',
      progress: 30, 
      thumbnail: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=150&q=80',
      videoId: 'vid_456'
    }
  ]);

  const handleRemove = useCallback((e, sessionId) => {
    e.stopPropagation();
    e.preventDefault();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  const handleCardClick = useCallback((session) => {
    // Navigate to video with timestamp
    const timestamp = (session.progress / 100) * session.duration;
    window.location.href = `/watch/${session.videoId}?t=${timestamp}`;
  }, []);

  const handleKeyDown = useCallback((e, session) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(session);
    }
  }, [handleCardClick]);

  const handleImageError = useCallback((e) => {
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='200' viewBox='0 0 150 200'%3E%3Crect width='100%25' height='100%25' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%237F77DD' font-family='sans-serif' font-size='14' font-weight='bold'%3ENo Preview%3C/text%3E%3C/svg%3E";
  }, []);

  const hasSessions = useMemo(() => sessions.length > 0, [sessions.length]);

  if (!hasSessions) {
    return null;
  }

  return (
    <div 
      className="w-full bg-black flex flex-col justify-center px-4 sm:px-6 py-5 sm:py-6 relative overflow-hidden my-2 border-y border-white/[0.05]"
      role="region"
      aria-label="Continue watching"
    >
      <div className="w-full mx-auto z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD] border border-[#7F77DD]/20">
              <PlayCircle size={14} strokeWidth={2.5} />
            </div>
            <span className="text-[#7F77DD] text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase">
              Continue Watching
            </span>
          </div>
          
          {/* Clear All (optional) */}
          {sessions.length > 1 && (
            <button 
              className="text-white/30 hover:text-white/60 text-[10px] sm:text-[11px] font-medium transition-colors"
              aria-label="Clear all continue watching"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Sessions List */}
        <div 
          className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 snap-x hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
          role="list"
          aria-label="Continue watching sessions"
        >
          {sessions.map((session, index) => (
            <div 
              key={session.id}
              onClick={() => handleCardClick(session)}
              onKeyDown={(e) => handleKeyDown(e, session)}
              className="min-w-[240px] sm:min-w-[260px] max-w-[240px] sm:max-w-[260px] flex items-center p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] snap-start hover:bg-white/[0.05] transition-all cursor-pointer group relative focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50"
              role="listitem"
              tabIndex={0}
              aria-label={`Continue watching ${session.title} at ${session.progress}%`}
            >
              {/* Remove Button */}
              <button
                onClick={(e) => handleRemove(e, session.id)}
                className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-white/30"
                aria-label={`Remove ${session.title} from continue watching`}
                tabIndex={-1}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
              
              {/* Thumbnail & Progress */}
              <div className="w-[52px] h-[72px] rounded-lg bg-white/5 overflow-hidden relative flex-shrink-0 border border-white/10 group-hover:border-white/20 transition-colors">
                <img 
                  src={session.thumbnail} 
                  alt={session.title} 
                  loading="lazy"
                  decoding="async"
                  onError={handleImageError}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/20">
                  <div 
                    className="h-full bg-[#7F77DD] transition-all duration-300" 
                    style={{ width: `${session.progress}%` }} 
                    role="progressbar"
                    aria-valuenow={session.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                {/* Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-[#7F77DD]/90 backdrop-blur-sm flex items-center justify-center text-white">
                    <Play size={14} fill="currentColor" strokeWidth={2} />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-col flex-grow ml-3 overflow-hidden pr-6">
                <h3 className="text-white/95 text-[12px] sm:text-[13px] font-semibold leading-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1">
                  {session.title}
                </h3>
                <span className="text-white/40 text-[10px] sm:text-[11px] mb-2">
                  {session.creator}
                </span>
                
                <div className="flex items-center gap-1.5 text-[#7F77DD] text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">
                  <Play size={9} fill="currentColor" strokeWidth={2} /> 
                  <span>{session.progress}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default ContinueWatching;