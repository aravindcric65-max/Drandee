import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slash, Flag, X } from 'lucide-react';

export const MoreMenu = ({ isOpen, onClose, postId, onNotInterested, onReport }) => {
  const menuRef = useRef(null);

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
    if (onNotInterested && postId) {
      onNotInterested(postId);
    }
    onClose();
  }, [onNotInterested, postId, onClose]);

  const handleReport = useCallback(() => {
    if (onReport && postId) {
      onReport(postId);
    }
    onClose();
  }, [onReport, postId, onClose]);

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
            className="w-full sm:max-w-[340px] bg-[#121215] border-t sm:border border-white/10 rounded-t-[28px] sm:rounded-2xl pb-6 sm:pb-4 pt-3 sm:pt-4 overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 pb-2 sm:pb-3 border-b border-white/5 mb-2">
              <h3 
                id="more-menu-title"
                className="text-white font-bold text-base"
              >
                More options
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Close menu"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex flex-col" role="menu" aria-labelledby="more-menu-title">
              {/* Not Interested */}
              <button 
                onClick={handleNotInterested}
                onKeyDown={(e) => handleKeyDown(e, handleNotInterested)}
                className="flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left hover:bg-white/5 active:bg-white/10 transition-colors group focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30 focus:ring-inset"
                role="menuitem"
                aria-label="Mark as not interested"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  <Slash size={20} className="text-white/70 group-hover:text-white" strokeWidth={2} />
                </div>
                <span className="text-white/90 group-hover:text-white font-semibold text-[14px] sm:text-[15px]">
                  Not interested
                </span>
              </button>
              
              {/* Report */}
              <button 
                onClick={handleReport}
                onKeyDown={(e) => handleKeyDown(e, handleReport)}
                className="flex items-center gap-4 w-full px-5 sm:px-6 py-4 text-left hover:bg-red-500/10 active:bg-red-500/20 transition-colors group focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:ring-inset"
                role="menuitem"
                aria-label="Report this post"
              >
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <Flag size={20} className="text-red-400 group-hover:text-red-300" strokeWidth={2} />
                </div>
                <span className="text-red-400 group-hover:text-red-300 font-semibold text-[14px] sm:text-[15px]">
                  Report
                </span>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="px-4 sm:px-5 pt-3 sm:pt-4 mt-2 border-t border-white/5">
              <button
                onClick={onClose}
                onKeyDown={(e) => handleKeyDown(e, onClose)}
                className="w-full py-3 rounded-full bg-white/5 text-white/70 font-semibold text-[14px] hover:bg-white/10 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Cancel"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MoreMenu;