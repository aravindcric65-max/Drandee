import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';

export const PostInfo = ({ post, onTagClick }) => {
  const [expanded, setExpanded] = useState(false);
  
  const caption = useMemo(() => {
    return post.caption || post.content?.caption || '';
  }, [post.caption, post.content]);

  const tags = useMemo(() => {
    return post.tags || post.content?.tags || post.hashtags || [];
  }, [post.tags, post.content, post.hashtags]);

  const hasContent = useMemo(() => {
    return caption || (tags && tags.length > 0);
  }, [caption, tags]);

  const toggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(prev => !prev);
    }
  }, []);

  const isLong = useMemo(() => {
    return caption && caption.length > 100;
  }, [caption]);

  if (!hasContent) {
    return null;
  }

  return (
    <div 
      className="w-full pt-1 pb-1 flex flex-col items-start z-10 px-1"
      role="article"
      aria-label="Post information"
    >
      
      {/* Caption */}
      {caption && (
        <motion.div 
          layout
          className="w-full text-white/90 text-[14px] sm:text-[15px] leading-relaxed mb-2 cursor-pointer overflow-hidden"
          onClick={toggleExpand}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Show less caption' : 'Show more caption'}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <motion.p 
            layout 
            className={`break-words ${!expanded ? 'line-clamp-3' : ''}`}
          >
            {caption}
          </motion.p>
          
          {isLong && !expanded && (
            <motion.span 
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-block mt-1 font-medium text-white/50 hover:text-white transition-colors"
            >
              more
            </motion.span>
          )}
        </motion.div>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div 
          className="flex flex-wrap gap-1.5 mt-1"
          role="list"
          aria-label="Post tags"
        >
          {tags.map((tag, idx) => {
            const tagText = typeof tag === 'string' ? tag.replace('#', '') : tag;
            
            return (
              <span 
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick && onTagClick(tagText);
                }}
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
  );
};

export default PostInfo;