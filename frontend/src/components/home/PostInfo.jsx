import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';


export const PostInfo = ({ post, onTagClick }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  
  const caption = useMemo(() => {
    // Safe string extractor — never returns an object, never calls .trim() on non-strings
    const extractStr = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        const v = val.caption || val.text || '';
        return typeof v === 'string' ? v : '';
      }
      return String(val);
    };

    // Fallback cascade: post.caption → post.content.caption → post.text → post.content.text
    const pCap = extractStr(post.caption);
    if (pCap.trim()) return pCap;

    const cCap = extractStr(post.content?.caption);
    if (cCap.trim()) return cCap;

    const pText = extractStr(post.text);
    if (pText.trim()) return pText;

    const cText = extractStr(post.content?.text);
    if (cText.trim()) return cText;

    return '';
  }, [post.caption, post.content, post.text]);

  const tags = useMemo(() => {
    const raw = post.tags || post.content?.tags || post.hashtags || [];
    const fromArray = Array.isArray(raw)
      ? raw.map(t => (typeof t === 'string' ? t : t != null ? String(t) : null)).filter(Boolean)
      : [];
    if (fromArray.length > 0) return fromArray;
    // Parse #hashtags directly from caption when tags array is empty
    const src = caption; // caption is already computed in this component
    if (!src) return [];
    const matches = src.match(/#[\p{L}\p{N}_]+/gu) || [];
    return [...new Set(matches.map(t => t.slice(1)))];
  }, [post.tags, post.content, post.hashtags, caption]);

  const hasContent = useMemo(() => {
    return Boolean(caption) || tags.length > 0;
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
    return caption.length > 100;
  }, [caption]);

  const renderCaptionWithTags = useCallback((text) => {
    if (!text) return null;
    const TAG_RE = /#([\p{L}\p{N}_]+)/gu;
    const parts = [];
    let lastIndex = 0;
    let match;
    let partIdx = 0;
    while ((match = TAG_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`t-${partIdx++}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      const tagText = match[1];
      parts.push(
        <span
          key={`h-${partIdx++}`}
          onClick={(e) => { e.stopPropagation(); if (onTagClick) onTagClick(tagText); else navigate(`/tag/${tagText}`); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (onTagClick) onTagClick(tagText); else navigate(`/tag/${tagText}`); }}}
          className="text-[#7F77DD] font-medium cursor-pointer hover:underline"
          role="link"
          tabIndex={0}
          aria-label={`Hashtag: ${tagText}`}
        >
          {match[0]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={`t-${partIdx}`}>{text.slice(lastIndex)}</span>);
    }
    return parts;
  }, [onTagClick, navigate]);

  const extraTags = useMemo(() => {
    if (tags.length === 0) return [];
    const inCaption = new Set((caption.match(/#([\p{L}\p{N}_]+)/gu) || []).map(t => t.slice(1).toLowerCase()));
    return tags.filter(t => !inCaption.has(t.toLowerCase()));
  }, [tags, caption]);

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
          className="w-full text-inherit text-[14px] sm:text-[15px] leading-relaxed mb-2 cursor-pointer overflow-hidden"
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
            {renderCaptionWithTags(caption)}
          </motion.p>
          
          {isLong && !expanded && (
            <motion.span 
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-block mt-1 font-medium text-[#8A8A8F] hover:text-[#111111] transition-colors"
            >
              more
            </motion.span>
          )}
          {isLong && expanded && (
            <motion.span
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-block mt-1 font-medium text-[#8A8A8F] hover:text-[#111111] transition-colors"
            >
              less
            </motion.span>
          )}
        </motion.div>
      )}

      {/* Tags */}
      {extraTags.length > 0 && (
        <div 
          className="flex flex-wrap gap-1.5 mt-1"
          role="list"
          aria-label="Post tags"
        >
          {extraTags.map((tag, idx) => {
            const tagText = tag.replace(/^#+/, '');
            
            return (
              <span 
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTagClick) {
                    onTagClick(tagText);
                  } else {
                    navigate(`/tag/${tagText}`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onTagClick) onTagClick(tagText);
                    else navigate(`/tag/${tagText}`);
                  }
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