import React, { useEffect, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slash, Flag, X, Trash2, Share2, Bookmark, BellOff } from 'lucide-react';

export const MoreMenu = ({ 
  isOpen, onClose, postId, creatorId, isOwner, 
  onNotInterested, onMute, onReport, onDeleteSuccess, onShare, onSave,
  dark = false
}) => {
  const menuRef = useRef(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
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
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstButton = menuRef.current.querySelector('button');
      if (firstButton) {
        firstButton.focus();
      }
    }
  }, [isOpen]);

  const handleNotInterested = useCallback(() => {
    if (onNotInterested && postId) onNotInterested(postId);
    onClose();
  }, [onNotInterested, postId, onClose]);

  const handleReport = useCallback(() => {
    if (onReport && postId) onReport(postId);
    onClose();
  }, [onReport, postId, onClose]);

  const handleMute = useCallback(() => {
    if (onMute && creatorId) onMute(creatorId);
    onClose();
  }, [onMute, creatorId, onClose]);

  const handleDeleteClick = useCallback(() => {
    setIsConfirmingDelete(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!postId || isDeleting) return;
    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE'});
      const data = await response.json();
      
      if (data.success || response.status === 200) {
        // Dispatch event so Profile/Home/Spotlight can react
        const event = new CustomEvent('post_deleted', { detail: { postId } });
        window.dispatchEvent(event);
        
        if (onDeleteSuccess) onDeleteSuccess(postId);
        setIsConfirmingDelete(false);
        onClose();
        
        // Show a native toast or alert (using alert as fallback for toast)
        // Assume there's a toast system, if not just silently succeed
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete post.');
    } finally {
      setIsDeleting(false);
    }
  }, [postId, isDeleting, onDeleteSuccess, onClose]);

  const handleKeyDown = useCallback((e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  const modalVariants = {
    hidden: {
      y: '100%',
      opacity: 0,
      scale: 0.95
    },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        bounce: 0,
        duration: 0.4,
        damping: 25,
        mass: 1
      }
    },
    exit: {
      y: '100%',
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.3,
        ease: "easeInOut"
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="more-menu-title"
        >
          <motion.div 
            ref={menuRef}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-[340px] ${dark ? 'bg-[#1a1a1a]' : 'bg-[#FFFFFF]'} border-t sm:border ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'} rounded-t-[28px] sm:rounded-2xl pb-6 sm:pb-4 pt-3 sm:pt-4 overflow-hidden shadow-2xl`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 sm:px-5 pb-2 sm:pb-3 border-b ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'} mb-2`}>
              <h3 
                id="more-menu-title"
                className={`${dark ? 'text-white' : 'text-[#111111]'} font-bold text-base`}
              >
                More options
              </h3>
              <button
                onClick={onClose}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${dark ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-[#666666] hover:text-[#111111] hover:bg-[#E8E8EC]'} transition-all focus:outline-none focus:ring-2 focus:ring-[#E8E8EC]`}
                aria-label="Close menu"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex flex-col" role="menu" aria-labelledby="more-menu-title">
              
              {isConfirmingDelete ? (
                <div className="px-5 pb-2">
                  <p className={`${dark ? 'text-white' : 'text-[#111111]'} font-semibold text-center mb-4`}>Delete this post?</p>
                  {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeleting}
                      className={`flex-1 py-3 rounded-full ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#E8E8EC] text-[#111111] hover:bg-black/10'} font-semibold transition-colors`}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleConfirmDelete}
                      disabled={isDeleting}
                      className="flex-1 py-3 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                      aria-label="Confirm delete post"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {isOwner ? (
                    <>
                      <button 
                        onClick={handleDeleteClick}
                        onKeyDown={(e) => handleKeyDown(e, handleDeleteClick)}
                        className="flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left hover:bg-red-500/10 active:bg-red-500/20 transition-colors group focus:outline-none"
                        role="menuitem"
                        aria-label="Delete post"
                      >
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20">
                          <Trash2 size={20} className="text-red-500" strokeWidth={2} />
                        </div>
                        <span className="text-red-500 font-semibold text-[14px] sm:text-[15px]">Delete</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={handleNotInterested}
                        onKeyDown={(e) => handleKeyDown(e, handleNotInterested)}
                        className={`flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left ${dark ? 'hover:bg-white/10 active:bg-white/20' : 'hover:bg-black/5 active:bg-black/10'} transition-colors group focus:outline-none`}
                        role="menuitem"
                      >
                        <div className={`w-10 h-10 rounded-full ${dark ? 'bg-white/10 group-hover:bg-white/20' : 'bg-black/5 group-hover:bg-black/10'} flex items-center justify-center`}>
                          <Slash size={20} className={`${dark ? 'text-white/60 group-hover:text-white' : 'text-[#666666] group-hover:text-[#111111]'}`} strokeWidth={2} />
                        </div>
                        <span className={`${dark ? 'text-white' : 'text-[#111111]'} font-semibold text-[14px] sm:text-[15px]`}>Not interested</span>
                      </button>
                      
                      <button 
                        onClick={handleReport}
                        onKeyDown={(e) => handleKeyDown(e, handleReport)}
                        className={`flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left ${dark ? 'hover:bg-white/10 active:bg-white/20' : 'hover:bg-black/5 active:bg-black/10'} transition-colors group focus:outline-none`}
                        role="menuitem"
                      >
                        <div className={`w-10 h-10 rounded-full ${dark ? 'bg-white/10 group-hover:bg-white/20' : 'bg-black/5 group-hover:bg-black/10'} flex items-center justify-center`}>
                          <Flag size={20} className={`${dark ? 'text-white/60 group-hover:text-white' : 'text-[#666666] group-hover:text-[#111111]'}`} strokeWidth={2} />
                        </div>
                        <span className={`${dark ? 'text-white' : 'text-[#111111]'} font-semibold text-[14px] sm:text-[15px]`}>Report</span>
                      </button>

                      {onMute && creatorId && (
                        <button 
                          onClick={handleMute}
                          onKeyDown={(e) => handleKeyDown(e, handleMute)}
                          className={`flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left ${dark ? 'hover:bg-white/10 active:bg-white/20' : 'hover:bg-black/5 active:bg-black/10'} transition-colors group focus:outline-none`}
                          role="menuitem"
                        >
                          <div className={`w-10 h-10 rounded-full ${dark ? 'bg-white/10 group-hover:bg-white/20' : 'bg-black/5 group-hover:bg-black/10'} flex items-center justify-center`}>
                            <BellOff size={20} className={`${dark ? 'text-white/60 group-hover:text-white' : 'text-[#666666] group-hover:text-[#111111]'}`} strokeWidth={2} />
                          </div>
                          <span className={`${dark ? 'text-white' : 'text-[#111111]'} font-semibold text-[14px] sm:text-[15px]`}>Mute creator</span>
                        </button>
                      )}

                    </>
                  )}

                  {/* Common Actions */}
                  {onShare && (
                    <button onClick={() => { onShare(postId); onClose(); }} className={`flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left ${dark ? 'hover:bg-white/10 active:bg-white/20' : 'hover:bg-black/5 active:bg-black/10'} transition-colors group`} role="menuitem">
                      <div className={`w-10 h-10 rounded-full ${dark ? 'bg-white/10 group-hover:bg-white/20' : 'bg-black/5 group-hover:bg-black/10'} flex items-center justify-center`}>
                        <Share2 size={20} className={`${dark ? 'text-white/60 group-hover:text-white' : 'text-[#666666] group-hover:text-[#111111]'}`} strokeWidth={2} />
                      </div>
                      <span className={`${dark ? 'text-white' : 'text-[#111111]'} font-semibold text-[14px] sm:text-[15px]`}>Share</span>
                    </button>
                  )}
                  {onSave && (
                    <button onClick={() => { onSave(postId); onClose(); }} className={`flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left ${dark ? 'hover:bg-white/10 active:bg-white/20' : 'hover:bg-black/5 active:bg-black/10'} transition-colors group`} role="menuitem">
                      <div className={`w-10 h-10 rounded-full ${dark ? 'bg-white/10 group-hover:bg-white/20' : 'bg-black/5 group-hover:bg-black/10'} flex items-center justify-center`}>
                        <Bookmark size={20} className={`${dark ? 'text-white/60 group-hover:text-white' : 'text-[#666666] group-hover:text-[#111111]'}`} strokeWidth={2} />
                      </div>
                      <span className={`${dark ? 'text-white' : 'text-[#111111]'} font-semibold text-[14px] sm:text-[15px]`}>Save / Unsave</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Cancel Button */}
            {!isConfirmingDelete && (
              <div className={`px-4 sm:px-5 pt-3 sm:pt-4 mt-2 border-t ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'}`}>
                <button
                  onClick={onClose}
                  onKeyDown={(e) => handleKeyDown(e, onClose)}
                  className={`w-full py-3 rounded-full ${dark ? 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white' : 'bg-black/5 text-[#8A8A8F] hover:bg-black/10 hover:text-[#111111]'} font-semibold text-[14px] transition-all focus:outline-none`}
                  aria-label="Cancel"
                >
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MoreMenu;