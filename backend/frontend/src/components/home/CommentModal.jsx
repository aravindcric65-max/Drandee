import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserContext } from '../../context/UserContext';
import { SendIcon } from '../reels/ReelsIcons';
import { useNavigate } from 'react-router-dom';
import { Pin } from 'lucide-react';

export const CommentModal = ({ isOpen, onClose, postId, postCreatorId }) => {
  const { user, postComments, addComment, token } = useContext(UserContext) || {};
  const [cmtText, setCmtText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const navigate = useNavigate();
  
  const commentsListRef = useRef(null);
  const inputRef = useRef(null);
  const comments = postId ? (postComments?.[postId] || []) : [];

  useEffect(() => {
    if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (commentsListRef.current && !replyTo) {
      commentsListRef.current.scrollTop = commentsListRef.current.scrollHeight;
    }
  }, [comments.length, replyTo]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (replyTo) setReplyTo(null); else onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, replyTo]);

  const handleSend = useCallback(async () => {
    if (!cmtText.trim() || !postId) return;
    setIsSending(true);
    try {
      if (addComment) {
        await addComment(postId, cmtText.trim(), user?.id, user?.username || user?.name || 'User', replyTo?.id);
      }
      setCmtText('');
      setReplyTo(null);
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSending(false);
    }
  }, [cmtText, postId, addComment, user, replyTo]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNavigateToProfile = useCallback((userId) => {
    if (userId) navigate(`/profile/${userId}`);
  }, [navigate]);

  const handlePinToggle = async (commentId) => {
    try {
      const authToken = token || localStorage.getItem('token');
      await fetch(`/api/engagement/comments/${commentId}/pin`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      // A full app would force refresh the comments array here.
    } catch(err) {
      console.error(err);
    }
  };

  const modalVariants = {
    hidden: { y: '100%', opacity: 0, scale: 0.95 },
    visible: { y: 0, opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0, duration: 0.4, damping: 25, mass: 1 } },
    exit: { y: '100%', opacity: 0, scale: 0.95, transition: { duration: 0.3, ease: 'easeInOut' } }
  };

  // Group comments into parents and children
  const topLevelComments = comments.filter(c => !c.parent_comment_id);
  const replies = comments.filter(c => c.parent_comment_id);
  const isPostAuthor = user?.id === postCreatorId;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/20" onClick={onClose}>
          <motion.div 
            variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[420px] h-[60vh] sm:h-[60vh] bg-[var(--bg-primary)] border-t sm:border border-[var(--border)] rounded-t-[28px] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden relative"
          >
            <div className="w-full pt-4 pb-3 flex flex-col items-center border-b border-[var(--border)] relative shrink-0 bg-[var(--bg-secondary)]">
              <div className="w-10 h-1.5 bg-white/20 rounded-full mb-3 sm:hidden cursor-pointer" onClick={onClose} />
              <h3 className="text-[var(--text-primary)] font-bold text-base tracking-wide">Comments</h3>
              <p className="text-[var(--text-secondary)] text-[11px] mt-1 font-medium">{comments.length} comments</p>
            </div>
            
            <div ref={commentsListRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scroll-smooth">
              {topLevelComments.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-secondary)] text-sm py-12">
                  <p>No comments yet. Be the first!</p>
                </div>
              ) : (
                topLevelComments.map(cmt => (
                  <div key={cmt.id} className="flex flex-col gap-2">
                    <div className="flex gap-3 group">
                      <div onClick={() => handleNavigateToProfile(cmt.userId)} className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold text-xs shrink-0 cursor-pointer">
                        {cmt.user ? cmt.user.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span onClick={() => handleNavigateToProfile(cmt.userId)} className="text-[var(--text-secondary)] text-xs font-semibold cursor-pointer">@{cmt.user}</span>
                          {cmt.is_pinned && <Pin size={10} className="text-[var(--primary)] fill-[var(--primary)]" />}
                        </div>
                        <span className="text-[var(--text-primary)] text-sm mt-0.5 whitespace-pre-wrap">{cmt.text}</span>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[10px] text-[var(--text-secondary)] cursor-pointer hover:text-white" onClick={() => { setReplyTo(cmt); inputRef.current?.focus(); }}>Reply</span>
                          {isPostAuthor && (
                            <span className="text-[10px] text-[var(--text-secondary)] cursor-pointer hover:text-white" onClick={() => handlePinToggle(cmt.id)}>{cmt.is_pinned ? 'Unpin' : 'Pin'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Render Replies */}
                    <div className="pl-12 flex flex-col gap-3 mt-1">
                      {replies.filter(r => r.parent_comment_id === cmt.id).map(reply => (
                        <div key={reply.id} className="flex gap-3">
                          <div onClick={() => handleNavigateToProfile(reply.userId)} className="w-7 h-7 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-white font-bold text-[10px] shrink-0 cursor-pointer">
                            {reply.user ? reply.user.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span onClick={() => handleNavigateToProfile(reply.userId)} className="text-[var(--text-secondary)] text-[10px] font-semibold cursor-pointer">@{reply.user}</span>
                            <span className="text-[var(--text-primary)] text-xs mt-0.5 whitespace-pre-wrap">{reply.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Box */}
            <div className="w-full flex flex-col bg-[var(--bg-secondary)] border-t border-[var(--border)] shrink-0 pb-[env(safe-area-inset-bottom)]">
              {replyTo && (
                <div className="px-4 py-2 bg-[var(--bg-primary)] flex justify-between items-center border-b border-[var(--border)]">
                  <span className="text-xs text-[var(--text-secondary)]">Replying to @{replyTo.user}</span>
                  <button onClick={() => setReplyTo(null)} className="text-xs text-[var(--text-primary)]">Cancel</button>
                </div>
              )}
              <div className="p-3 flex items-center gap-2">
                <input 
                  ref={inputRef} type="text" placeholder="Add a comment..." value={cmtText} onChange={(e) => setCmtText(e.target.value)} onKeyDown={handleKeyDown} disabled={isSending}
                  className="flex-1 bg-white/5 border border-[var(--border)] rounded-full px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
                />
                <button onClick={handleSend} disabled={!cmtText.trim() || isSending} className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--text-primary)] disabled:opacity-50 transition-all hover:bg-[var(--primary-light)] shrink-0">
                  <SendIcon />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default CommentModal;