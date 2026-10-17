import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeedCreatorHeader } from './FeedCreatorHeader';
import { PostActions } from './PostActions';
import { PostInfo } from './PostInfo';

export const PhotoPost = ({ post, isActive, index, interactionProps }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [bursts, setBursts] = useState([]);
  const lastTapRef = useRef(0);
  const containerRef = useRef(null);

  const imageUrl = useMemo(() => {
    return post.content?.imageUrl || post.imageUrl;
  }, [post.content, post.imageUrl]);

  const imageAlt = useMemo(() => {
    return post.content?.caption || post.caption || 'Photo';
  }, [post.content, post.caption]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    
    // Get click coordinates relative to the container
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newBurst = { id: Date.now(), x, y };
    setBursts(prev => [...prev, newBurst]);
    
    // Trigger respect action (forceAdd=true to prevent unlike)
    if (interactionProps?.onRespect) {
      interactionProps.onRespect(post.id, true);
    }

    // Clean up burst after animation completes (1 second)
    setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== newBurst.id));
    }, 1000);
  }, [interactionProps, post.id]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleImageError = useCallback((e) => {
    if (e.target.dataset.error !== 'true') {
      e.target.dataset.error = 'true';
      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='100%25' height='100%25' fill='%230a0a0f'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%237F77DD' font-family='sans-serif' font-size='20' font-weight='bold'%3EImage Unavailable%3C/text%3E%3C/svg%3E";
      setIsLoaded(true);
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Simulate double tap on keyboard
      if (interactionProps?.onRespect) {
        interactionProps.onRespect(post.id, true);
      }
    }
  }, [interactionProps, post.id]);

  return (
    <div 
      className="w-full bg-transparent flex flex-col"
      role="article"
      aria-label="Photo post"
    >
      <FeedCreatorHeader 
        post={post} 
        onFollow={interactionProps.onFollow} 
        onMore={interactionProps.onMore} 
      />

      {/* Photo Content */}
      <div 
        ref={containerRef}
        className="relative w-full max-h-[75vh] min-h-[300px] bg-black/40 border border-white/5 rounded-[20px] overflow-hidden flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50"
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View photo post by ${post.creator?.displayName || 'user'}`}
      >
        {/* Loading Placeholder */}
        {!isLoaded && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]"
            aria-label="Loading image"
          >
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}

        {/* The Image */}
        <img 
          src={imageUrl} 
          alt={imageAlt}
          loading={index < 2 ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full max-h-[75vh] object-contain transition-opacity duration-500 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          draggable={false}
        />

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
                  className="absolute inset-0 rounded-full bg-red-500 mix-blend-screen"
                />
                {/* Core Shape */}
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" className="text-red-500 drop-shadow-xl relative z-10">
                  <path d="M12 2l2.4 7.6h8l-6.4 4.8 2.4 7.6-6.4-4.8-6.4 4.8 2.4-7.6-6.4-4.8h8z" fill="currentColor" />
                </svg>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Caption directly below content */}
      <div className="mt-4 mb-1 px-1">
        <PostInfo post={post} />
      </div>

      {/* Action Bar */}
      <div className="mt-2 px-1">
        <PostActions post={post} onViews={interactionProps?.onViewsClick} {...interactionProps} />
      </div>
    </div>
  );
};

export default PhotoPost;