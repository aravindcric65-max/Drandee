import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeedCreatorHeader } from './FeedCreatorHeader';
import { PostActions } from './PostActions';

export const TextPost = ({ post, isActive, index, interactionProps }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const fullText = useMemo(() => {
    // Safe string extractor — never returns an object
    const extractStr = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        const v = val.text || val.caption || '';
        return typeof v === 'string' ? v : '';
      }
      return String(val);
    };

    // For text posts: content.text first (may include overlay_text), then content.caption, then flat fields
    const cText = extractStr(post.content?.text);
    if (cText.trim()) return cText;
    
    const cCap = extractStr(post.content?.caption);
    if (cCap.trim()) return cCap;
    
    const pText = extractStr(post.text);
    if (pText.trim()) return pText;
    
    const pCap = extractStr(post.caption);
    if (pCap.trim()) return pCap;
    
    return '';
  }, [post.content, post.text, post.caption]);

  const paragraphs = useMemo(() => {
    return fullText.split('\n').filter(p => p.trim() !== '');
  }, [fullText]);

  const isLong = useMemo(() => {
    return fullText.length > 200 || paragraphs.length > 3;
  }, [fullText, paragraphs]);

  const displayParagraphs = useMemo(() => {
    if (isExpanded) {
      return paragraphs;
    }
    
    if (isLong) {
      const truncated = fullText.substring(0, 200);
      return truncated.split('\n').filter(p => p.trim() !== '');
    }
    
    return paragraphs;
  }, [isExpanded, isLong, paragraphs, fullText]);

  const handleExpand = useCallback((e) => {
    e.stopPropagation();
    setIsExpanded(true);
  }, []);

  const handleCollapse = useCallback((e) => {
    e.stopPropagation();
    setIsExpanded(false);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded(prev => !prev);
    }
  }, []);

  // Safe tags: ensure every entry is a string
  const tags = useMemo(() => {
    const raw = post.tags || post.hashtags || [];
    if (!Array.isArray(raw)) return [];
    return raw.map(t => (typeof t === 'string' ? t : t != null ? String(t) : null)).filter(Boolean);
  }, [post.tags, post.hashtags]);

  return (
    <div 
      className="w-full bg-transparent flex flex-col"
      role="article"
      aria-label="Text post"
    >
      <FeedCreatorHeader 
        post={post} 
        onFollow={interactionProps.onFollow} 
        onMore={interactionProps.onMore} 
      />
      
      {/* Text body container */}
      <div 
        className="w-full pt-5 sm:pt-6 pb-6 sm:pb-8 flex flex-col items-start justify-center mt-2 px-1"
      >
        <div className="w-full flex flex-col gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {displayParagraphs.map((text, idx) => (
              <motion.p 
                key={`${idx}-${isExpanded}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className={`leading-[1.35] ${
                  idx === 0 
                    ? 'text-[22px] sm:text-[24px] md:text-[28px] font-bold tracking-tight text-white' 
                    : 'text-[16px] sm:text-[17px] md:text-[18px] font-medium tracking-normal text-white/70'
                }`}
                style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
              >
                {text}
                {!isExpanded && isLong && idx === displayParagraphs.length - 1 && '...'}
              </motion.p>
            ))}
          </AnimatePresence>

          {/* Expand/collapse controls */}
          {isLong && !isExpanded && (
            <button 
              onClick={handleExpand}
              onKeyDown={handleKeyDown}
              className="self-start font-medium text-white/50 hover:text-white transition-colors mt-2 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 rounded px-2 py-1"
              aria-label="Show more text"
            >
              more
            </button>
          )}
          {isLong && isExpanded && (
            <button
              onClick={handleCollapse}
              onKeyDown={handleKeyDown}
              className="self-start font-medium text-white/50 hover:text-white transition-colors mt-2 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 rounded px-2 py-1"
              aria-label="Show less text"
            >
              less
            </button>
          )}
        </div>
        
        {/* Tags */}
        {tags.length > 0 && (
          <div 
            className="flex flex-wrap gap-1.5 mt-4"
            role="list"
            aria-label="Post tags"
          >
            {tags.map((tag, idx) => {
              const tagText = tag.replace(/^#+/, '');
              
              return (
                <span 
                  key={idx}
                  className="text-[#7F77DD] text-[13px] sm:text-[14px] hover:underline cursor-pointer font-medium"
                  role="listitem"
                  tabIndex={0}
                  aria-label={`Tag: ${tagText}`}
                >
                  #{tagText}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="mt-2 px-1">
        <PostActions post={post} onViews={interactionProps?.onViewsClick} {...interactionProps} />
      </div>
    </div>
  );
};

export default TextPost;