import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { FeedCreatorHeader } from './FeedCreatorHeader';
import { PostActions } from './PostActions';
import { PostInfo } from './PostInfo';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicNoteIcon } from '../reels/ReelsIcons';

export const VideoPost = ({ post, isActive, index, interactionProps }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bursts, setBursts] = useState([]);
  const lastTapRef = useRef(0);
  const firedEvents = useRef(new Set());

  const videoUrl = useMemo(() => {
    return post.content?.videoUrl || post.videoUrl;
  }, [post.content, post.videoUrl]);

  const thumbnailUrl = useMemo(() => {
    let url = post.content?.thumbnailUrl || post.thumbnailUrl;
    if (url && url.includes('via.placeholder.com')) {
      url = url.replace('via.placeholder.com', 'placehold.co');
    }
    return url;
  }, [post.content, post.thumbnailUrl]);

  // Autoplay when active
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // Autoplay prevented by browser - gracefully fallback to paused state
            setIsPlaying(false);
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
      video.currentTime = 0;
      firedEvents.current = new Set();
    }
  }, [isActive, post]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current = null;
      }
      firedEvents.current = null;
    };
  }, []);

  const togglePlay = useCallback((e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastTapRef.current < 500) return; // Debounce duplicate events
    lastTapRef.current = now;
    
    // Get click coordinates relative to the container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newBurst = { id: Date.now(), x, y };
    setBursts(prev => [...prev, newBurst]);
    
    // Trigger the actual respect action (forceAdd=true to prevent unlike)
    if (interactionProps?.onRespect) {
      interactionProps.onRespect(post.id, true);
    }

    // Clean up burst after animation completes (1 second)
    setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== newBurst.id));
    }, 1000);
  }, [interactionProps, post.id]);

  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    if (duration > 0) {
      const p = (currentTime / duration) * 100;
      setProgress(p);

      
      if (firedEvents.current) {
        const fire = (event) => {
          if (!firedEvents.current) return;
          if (!firedEvents.current.has(event)) {
            firedEvents.current.add(event);
            fetch('/api/home/watch-event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ postId: post.id, event, watchTime: currentTime * 1000 })
            }).catch(() => {});
          }
        };

        if (p > 0 && p < 5) {
          if (firedEvents.current.has('video_complete') && !firedEvents.current.has('video_rewatch')) {
            fire('video_rewatch');
          } else {
            fire('video_start');
          }
        }
        if (p >= 25) fire('video_25');
        if (p >= 50) fire('video_50');
        if (p >= 75) fire('video_75');
        if (p >= 99) fire('video_complete');
      }
    }
  }, [post.id]);

  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handlePlaying = useCallback(() => setIsBuffering(false), []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePlay(e);
    } else if (e.key === 'm') {
      e.preventDefault();
      toggleMute(e);
    }
  }, [togglePlay, toggleMute]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
  }, [post.id]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  }, []);

  return (
    <div 
      className="w-full bg-transparent flex flex-col"
      role="article"
      aria-label="Video post"
    >
      <FeedCreatorHeader 
        post={post} 
        onFollow={interactionProps.onFollow} 
        onMore={interactionProps.onMore} 
      />

      {/* Video Content */}
      <div 
        className="relative w-full max-h-[75vh] min-h-[300px] bg-black/40 border border-white/5 rounded-[20px] overflow-hidden flex items-center justify-center group cursor-pointer mt-3 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
        onDoubleClick={handleDoubleClick}
        onClick={togglePlay}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
      >
        {!videoError ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl}
            preload={index < 2 ? "auto" : "metadata"}
            playsInline
            className="w-full max-h-[75vh] object-contain"
            loop
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => setVideoError(true)}
            aria-label={post.caption || 'Video content'}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a16] gap-2 p-6 text-center">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover opacity-40 absolute inset-0" />
            ) : null}
            <div className="relative z-10 text-white/70 text-sm font-medium">
              Video unavailable
            </div>
          </div>
        )}
        
        {/* Play/Pause Overlay Indicator */}
        <AnimatePresence>
          {!isPlaying && !videoError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none"
              aria-hidden="true"
            >
              <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                <Play size={32} fill="white" className="ml-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unique Drandee Respect Animation Bursts */}
        <AnimatePresence>
          {bursts.map(burst => (
            <motion.div
              key={burst.id}
              initial={{ opacity: 0, scale: 0.2, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.4, filter: 'blur(4px)' }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.5 }}
              className="absolute pointer-events-none z-30 flex items-center justify-center"
              style={{ left: burst.x - 40, top: burst.y - 40, width: 80, height: 80 }}
              aria-hidden="true"
            >
              <div className="relative flex items-center justify-center">
                {/* Outer Glow */}
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0.8 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-primary mix-blend-screen"
                />
                {/* Core Shape */}
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" className="text-primary drop-shadow-xl relative z-10">
                  <path d="M12 2l2.4 7.6h8l-6.4 4.8 2.4 7.6-6.4-4.8-6.4 4.8 2.4-7.6-6.4-4.8h8z" fill="currentColor" />
                </svg>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Mute Toggle */}
        <button 
          onClick={toggleMute}
          className="absolute bottom-3 left-3 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white z-20 hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Duration / Timer Pill */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold tracking-wider z-20 min-w-[48px] text-center">
          {formatTime(videoDuration)}
        </div>

        {/* Buffering Indicator */}
        <AnimatePresence>
          {isBuffering && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/10 z-10 pointer-events-none"
              aria-hidden="true"
            >
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal Progress Bar */}
        <div 
          className="absolute bottom-0 left-0 w-full h-[3px] bg-white/20"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Video progress"
        >
          <div 
            className="h-full bg-[var(--primary)] transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Caption directly below content */}
      <div className="mt-4 mb-1 px-1">
        <PostInfo post={post} onTagClick={interactionProps?.onTagClick} />
        
        {/* Original Audio Indicator */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            interactionProps?.onAudioClick && interactionProps.onAudioClick(post);
          }}
          className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-white/5 rounded-lg max-w-[240px] cursor-pointer backdrop-blur-sm group hover:bg-white/10 transition-colors"
        >
          <div className={`shrink-0 ${isPlaying ? 'animate-[spin_3s_linear_infinite]' : ''}`}>
            <MusicNoteIcon />
          </div>
          <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1">
            {post.audioName || 'Original Audio'}
          </span>
          <span className="text-[12px] text-white/50 shrink-0 truncate max-w-[80px]">
            · {post.creator?.displayName || post.creator?.username || 'Author'}
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-2 px-1">
        <PostActions post={post} onViews={interactionProps?.onViewsClick} {...interactionProps} />
      </div>
    </div>
  );
};

export default VideoPost;