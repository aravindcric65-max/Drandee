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
  const [hasRespected, setHasRespected] = useState(
    userInteraction.hasRespected ?? post.has_respected ?? post.hasRespected ?? false
  );
  const [respects, setRespects] = useState(
    stats.respects ?? post.totalRespects ?? post.respects ?? 0
  );
  // saves is initialized from post.saves (the reliable top-level field populated by postModel),
  // with stats.saves as fallback. Do NOT use stats.saves || 0 alone — stats may be stale.
  const [saves, setSaves] = useState(post.saves ?? stats.saves ?? 0);

  const [hasSaved, setHasSaved] = useState(
    userInteraction.hasSaved ?? post.has_saved ?? post.hasSaved ?? false
  );

  // Sync respect/hasSaved state when external engagement events update the parent
  React.useEffect(() => {
    setHasRespected(userInteraction.hasRespected ?? false);
  }, [userInteraction.hasRespected]);

  React.useEffect(() => {
    setRespects(stats.respects ?? post.totalRespects ?? post.respects ?? 0);
  }, [stats.respects, post.totalRespects, post.respects, post.id]);

  React.useEffect(() => {
    setHasSaved(userInteraction.hasSaved ?? false);
  }, [userInteraction.hasSaved]);

  // Sync saves count separately — driven ONLY by post.saves changing on the post object.
  // This fires when Feed.jsx processes engagement_updated and updates the post in its state.
  // Keeping this separate prevents a hasSaved change from resetting the optimistic saves count.
  React.useEffect(() => {
    setSaves(post.saves ?? stats.saves ?? 0);
  }, [post.saves, post.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [bursts, setBursts] = useState([]);
  
  const isSubmittingRespect = React.useRef(false);
  const isSubmittingSave = React.useRef(false);

  const handleRespect = useCallback(async (e) => {
    if (e) e.stopPropagation();
    if (isSubmittingRespect.current) return;
    isSubmittingRespect.current = true;
    
    const newVal = !hasRespected;
    setHasRespected(newVal);

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
    setSaves(s => newVal ? s + 1 : Math.max(0, s - 1));
    
    try {
      if (onSave) {
        await onSave(post.id);
      }
    } catch (error) {
      console.error('Save error:', error);
      setHasSaved(!newVal);
      setSaves(s => !newVal ? s + 1 : Math.max(0, s - 1));
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
      className="w-full py-1 flex items-center justify-between border-t border-black/8 pt-3 z-10 relative px-1"
      role="group"
      aria-label="Post actions"
    >
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 overflow-x-auto hide-scrollbar">
        {/* Views */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onViews && onViews(post.id, post.creator?.id); }}
          onKeyDown={(e) => handleKeyDown(e, () => onViews && onViews(post.id))}
          className={actionStyle}
          aria-label="Viewers list"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-black/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <EyeIcon w={18} />
          </div>
          <span className="text-[12px] sm:text-[13px] font-medium text-[#555555] transition-colors group-hover:text-[#111111]">
            {formatCount(stats.views || 0)}
          </span>
        </motion.button>

        {/* Respect */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={handleRespect}
          onKeyDown={(e) => handleKeyDown(e, handleRespect)}
          className={actionStyle}
          aria-label={hasRespected ? 'Remove respect' : 'Give respect'}
          aria-pressed={hasRespected}
          style={{ color: hasRespected ? '#FF3B30' : 'currentColor' }}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-black/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <RespectIcon active={hasRespected} />
          </div>
          {(!post.privacy?.hideRespectCount) && (
            <span className={`text-[12px] sm:text-[13px] font-semibold ${
            hasRespected ? 'text-[#FF3B30]' : 'text-[#555555]'
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
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-black/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <CommentIcon />
          </div>
          <span className="text-[12px] sm:text-[13px] font-semibold text-[#555555] transition-colors group-hover:text-[#111111]">
            {formatCount(commentCount)}
          </span>
        </motion.button>

        {/* Share */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onShare && onShare(post.id); }}
          onKeyDown={(e) => handleKeyDown(e, () => onShare && onShare(post.id))}
          className={actionStyle}
          aria-label="Share post"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-black/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <ShareIcon />
          </div>
          {(!post.privacy?.hideShareCount) && (
            <span className="text-[12px] sm:text-[13px] font-semibold text-[#555555] transition-colors group-hover:text-[#111111]">
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
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-black/5 group-hover:bg-[#7F77DD]/15 transition-colors">
            <BookmarkIcon active={hasSaved} />
          </div>
          <span className={`text-[12px] sm:text-[13px] font-semibold ${
            hasSaved ? 'text-[#AFA9EC]' : 'text-[#555555]'
          } transition-colors group-hover:text-[#111111]`}>
            {formatCount(saves)}
          </span>
        </motion.button>
      </div>

      {/* More / Menu */}
      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={() => onMore && onMore(post.id, post.creator?.id)}
        onKeyDown={(e) => handleKeyDown(e, () => onMore && onMore(post.id, post.creator?.id))}
        className="p-2 sm:p-2.5 rounded-full text-[#555555] hover:text-[#7F77DD] hover:bg-[#7F77DD]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30"
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