import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RespectIcon, CommentIcon, ShareIcon, BookmarkIcon, MoreIcon, EyeIcon 
} from '../reels/ReelsIcons';

export const PostActions = ({
  post,
  onRespect,
  onComment,
  onShare,
  onSave,
  onMore,
  onViews,
  userInteraction = {},
  stats = {}
}) => {
  // Optimistic State
  const [hasRespected, setHasRespected] = useState(userInteraction.hasRespected || false);
  const [respects, setRespects] = useState(stats.respects || 0);
  const [hasSaved, setHasSaved] = useState(userInteraction.hasSaved || false);
  const [bursts, setBursts] = useState([]);
  
  const isSubmittingRespect = React.useRef(false);
  const isSubmittingSave = React.useRef(false);

  const handleRespect = useCallback(async (e) => {
    if (e) e.stopPropagation();
    if (isSubmittingRespect.current) return;
    isSubmittingRespect.current = true;
    
    const newVal = !hasRespected;
    setHasRespected(newVal);
    setRespects(r => newVal ? r + 1 : r - 1);
    
    // Add burst animation if liking
    if (newVal) {
      const newBurst = { id: Date.now(), x: 20, y: 20 };
      setBursts(prev => [...prev, newBurst]);
      setTimeout(() => {
        setBursts(prev => prev.filter(b => b.id !== newBurst.id));
      }, 1000);
    }
    
    try {
      if (onRespect) {
        await onRespect(post.id);
      }
    } catch (error) {
      console.error('Respect error:', error);
      setHasRespected(!newVal);
      setRespects(r => !newVal ? r + 1 : r - 1);
    } finally {
      isSubmittingRespect.current = false;
    }
  }, [hasRespected, onRespect, post.id]);

  const handleSave = useCallback(async (e) => {
    if (e) e.stopPropagation();
    if (isSubmittingSave.current) return;
    isSubmittingSave.current = true;
    
    const newVal = !hasSaved;
    setHasSaved(newVal);
    
    try {
      if (onSave) {
        await onSave(post.id);
      }
    } catch (error) {
      console.error('Save error:', error);
      setHasSaved(!newVal);
    } finally {
      isSubmittingSave.current = false;
    }
  }, [hasSaved, onSave, post.id]);

  const handleKeyDown = useCallback((e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      action(e);
    }
  }, []);

  const actionStyle = useMemo(() => 
    "flex items-center gap-1.5 transition-colors duration-200 group rounded-xl hover:bg-[#7F77DD]/10 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30 focus:ring-inset"
  , []);

  const formatCount = useMemo(() => (count) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
  }, []);

  const commentCount = useMemo(() => {
    return stats.comments || 0;
  }, [stats.comments]);

  return (
    <div 
      className="w-full py-1 flex items-center justify-between border-t border-white/5 pt-3 z-10 relative px-1"
      role="group"
      aria-label="Post actions"
    >
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 overflow-x-auto hide-scrollbar">
        {/* Views */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onViews && onViews(post.id); }}
          onKeyDown={(e) => handleKeyDown(e, () => onViews && onViews(post.id))}
          className={actionStyle}
          aria-label="Viewers list"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <EyeIcon w={18} />
          </div>
          <span className="text-[12px] sm:text-[13px] font-medium text-white/60 transition-colors group-hover:text-white/80">
            {formatCount(stats.views || 0)}
          </span>
        </motion.button>

        {/* Respect */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={handleRespect}
          onKeyDown={(e) => handleKeyDown(e, handleRespect)}
          className={actionStyle}
          aria-label={hasRespected ? 'Unlike post' : 'Like post'}
          aria-pressed={hasRespected}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <RespectIcon active={hasRespected} />
          </div>
          {respects > 0 && (
            <span className={`text-[12px] sm:text-[13px] font-semibold ${
              hasRespected ? 'text-white/90' : 'text-white/60'
            }`}>
              {formatCount(respects)}
            </span>
          )}
        </motion.button>

        {/* Comment */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onComment && onComment(post.id); }}
          onKeyDown={(e) => handleKeyDown(e, () => onComment && onComment(post.id))}
          className={actionStyle}
          aria-label="Comment on post"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <CommentIcon />
          </div>
          {commentCount > 0 && (
            <span className="text-[12px] sm:text-[13px] font-semibold text-white/60 transition-colors group-hover:text-white/80">
              {formatCount(commentCount)}
            </span>
          )}
        </motion.button>

        {/* Share */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onShare && onShare(post.id); }}
          onKeyDown={(e) => handleKeyDown(e, () => onShare && onShare(post.id))}
          className={actionStyle}
          aria-label="Share post"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <ShareIcon />
          </div>
          {stats.shares > 0 && (
            <span className="text-[12px] sm:text-[13px] font-semibold text-white/60 transition-colors group-hover:text-white/80">
              {formatCount(stats.shares)}
            </span>
          )}
        </motion.button>
        
        {/* Save */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={handleSave}
          onKeyDown={(e) => handleKeyDown(e, handleSave)}
          className={actionStyle}
          aria-label={hasSaved ? 'Remove from saved' : 'Save post'}
          aria-pressed={hasSaved}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <BookmarkIcon active={hasSaved} />
          </div>
        </motion.button>
      </div>

      {/* More / Menu */}
      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={() => onMore && onMore(post.id)}
        onKeyDown={(e) => handleKeyDown(e, () => onMore && onMore(post.id))}
        className="p-2 sm:p-2.5 rounded-full text-white/60 hover:text-[#7F77DD] hover:bg-[#7F77DD]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30"
        aria-label="More options"
      >
        <MoreIcon />
      </motion.button>

      {/* Unique Respect Animation Bursts */}
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
              <motion.div 
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0 rounded-full bg-red-500 mix-blend-screen"
              />
              <RespectIcon active={true} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default PostActions;