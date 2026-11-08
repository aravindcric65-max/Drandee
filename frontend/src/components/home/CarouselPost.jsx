import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeedCreatorHeader } from './FeedCreatorHeader';
import { PostActions } from './PostActions';
import { PostInfo } from './PostInfo';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const CarouselPost = ({ post, isActive, index, interactionProps }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const images = useMemo(() => {
    return post.content?.images || post.images || [];
  }, [post.content, post.images]);

  const hasImages = images.length > 0;
  const totalImages = images.length;
  const isFirstImage = currentIndex === 0;
  const isLastImage = currentIndex === totalImages - 1;

  const handleDragEnd = useCallback((e, { offset, velocity }) => {
    const swipe = offset.x;
    const swipeVelocity = velocity.x;
    const threshold = 50;
    const velocityThreshold = 500;

    if (swipe < -threshold || swipeVelocity < -velocityThreshold) {
      // Swipe left - next image
      if (!isLastImage) {
        setCurrentIndex(prev => prev + 1);
      }
    } else if (swipe > threshold || swipeVelocity > velocityThreshold) {
      // Swipe right - previous image
      if (!isFirstImage) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  }, [isFirstImage, isLastImage]);

  const goToPrevious = useCallback(() => {
    if (!isFirstImage) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [isFirstImage]);

  const goToNext = useCallback(() => {
    if (!isLastImage) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [isLastImage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      goToPrevious();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    }
  }, [goToPrevious, goToNext]);

  const handleImageError = useCallback((e) => {
    if (e.target.dataset.error !== 'true') {
      e.target.dataset.error = 'true';
      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='100%25' height='100%25' fill='%230a0a0f'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%237F77DD' font-family='sans-serif' font-size='20' font-weight='bold'%3EImage Unavailable%3C/text%3E%3C/svg%3E";
    }
  }, []);

  return (
    <div 
      className="w-full bg-transparent flex flex-col overflow-hidden"
      role="region"
      aria-label="Carousel post"
      aria-roledescription="carousel"
    >
      <FeedCreatorHeader 
        post={post} 
        onFollow={interactionProps.onFollow} 
        onMore={interactionProps.onMore} 
      />

      {/* Carousel Content */}
      <div 
        className="relative w-full h-[60vh] max-h-[750px] min-h-[350px] bg-black rounded-[20px] overflow-hidden group cursor-pointer"
        onClick={() => interactionProps?.onViewPost?.(post.id, post)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label={`Image ${currentIndex + 1} of ${totalImages}`}
      >
        {hasImages ? (
          <motion.div 
            className="flex w-full h-full cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            dragMomentum={true}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(e, info) => {
              setIsDragging(false);
              handleDragEnd(e, info);
            }}
            animate={{ x: `-${currentIndex * 100}%` }}
            transition={{ 
              type: "spring", 
              stiffness: 350, 
              damping: 35,
              mass: 1
            }}
            style={{ willChange: 'transform' }}
          >
            {images.map((img, idx) => (
              <div 
                key={idx} 
                className="min-w-full h-full flex-shrink-0 relative bg-[#0a0a0f]"
                role="group"
                aria-label={`Slide ${idx + 1}`}
              >
                <img 
                  src={img.url || img} 
                  alt={img.alt || `Post image ${idx + 1}`}
                  loading={index < 2 && idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                  onError={handleImageError}
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />
              </div>
            ))}
          </motion.div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50 bg-[#0a0a0f]">
            <div className="text-center">
              <p className="text-sm font-medium">No images available</p>
            </div>
          </div>
        )}

        {/* Minimal Text Counter */}
        {hasImages && totalImages > 1 && (
          <div 
            className="absolute top-4 right-4 z-10 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 pointer-events-none"
            aria-hidden="true"
          >
            <span className="text-white/80 text-[11px] font-medium tracking-wide tabular-nums">
              {currentIndex + 1} / {totalImages}
            </span>
          </div>
        )}

        {/* Navigation Buttons */}
        {hasImages && totalImages > 1 && (
          <>
            <AnimatePresence>
              {!isFirstImage && (
                <motion.button 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/15 text-white/80 hover:text-white hover:bg-black/60 transition-all duration-200 z-20 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50"
                  aria-label="Previous image"
                  disabled={isDragging}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </motion.button>
              )}
              {!isLastImage && (
                <motion.button 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/15 text-white/80 hover:text-white hover:bg-black/60 transition-all duration-200 z-20 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50"
                  aria-label="Next image"
                  disabled={isDragging}
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Progress Dots */}
            <div 
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10"
              aria-label="Carousel navigation"
              role="tablist"
            >
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 ${
                    idx === currentIndex 
                      ? 'w-6 bg-[#7F77DD]' 
                      : 'w-1.5 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to image ${idx + 1}`}
                  role="tab"
                  aria-selected={idx === currentIndex}
                  tabIndex={idx === currentIndex ? 0 : -1}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Caption directly below content */}
      <div className="mt-4 mb-1 px-1">
        <PostInfo post={post} onTagClick={interactionProps?.onTagClick} />
      </div>

      {/* Action Bar */}
      <div className="mt-2 px-1">
        <PostActions post={post} onViews={interactionProps?.onViewsClick} {...interactionProps} />
      </div>
    </div>
  );
};

export default CarouselPost;