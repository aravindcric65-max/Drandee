import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WAIcon, TGIcon, TWIcon, LinkIcon, CheckCircleIcon } from '../reels/ReelsIcons';
// Using /v/:id canonical URL per seo.js config

export const ShareModal = ({ isOpen, onClose, postId, onShareComplete, dark = false }) => {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const modalRef = useRef(null);
  const firstButtonRef = useRef(null);

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
    if (isOpen && firstButtonRef.current) {
      setTimeout(() => {
        firstButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const deepLink = useMemo(() => {
    return `https://drandee.vercel.app/v/${postId}`;
  }, [postId]);

  const shareText = useMemo(() => {
    return "Check out this post on Drandee!";
  }, []);

  const handleShare = useCallback(async (platform) => {
    if (isSharing) return;
    
    setIsSharing(true);
    
    try {
      if (platform === "whatsapp") {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + deepLink)}`, "_blank");
      } else if (platform === "telegram") {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`, "_blank");
      } else if (platform === "twitter") {
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`, "_blank");
      } else if (platform === "copy") {
        try {
          await navigator.clipboard.writeText(deepLink);
          onShareComplete?.();
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
            onClose();
          }, 1500);
          return;
        } catch (err) {
          console.error("Failed to copy", err);
        }
      }
      onShareComplete?.();
      onClose();
    } catch (error) {
      console.error("Share error:", error);
    } finally {
      setIsSharing(false);
    }
  }, [deepLink, shareText, isSharing, onClose, onShareComplete]);

  const handleKeyDown = useCallback((e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  const platforms = useMemo(() => [
    { id: 'whatsapp', name: 'WhatsApp', icon: <WAIcon />, color: 'hover:bg-[#25D366]/10 text-[#25D366]' },
    { id: 'telegram', name: 'Telegram', icon: <TGIcon />, color: 'hover:bg-[#0088cc]/10 text-[#0088cc]' },
    { id: 'twitter', name: 'X (Twitter)', icon: <TWIcon />, color: 'hover:bg-black/5 text-[#111111]' },
    { id: 'copy', name: copied ? 'Copied!' : 'Copy Link', icon: copied ? <CheckCircleIcon /> : <LinkIcon />, color: 'hover:bg-[#7F77DD]/10 text-[#111111]' }
  ], [copied]);

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
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
        >
          <motion.div 
            ref={modalRef}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-[340px] ${dark ? 'bg-[#1a1a1a]' : 'bg-[#FFFFFF]'} border-t sm:border ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'} rounded-t-[28px] sm:rounded-2xl pb-6 sm:pb-4 pt-3 sm:pt-4 overflow-hidden shadow-2xl`}
          >
            {/* Mobile Drag Handle */}
            <div 
              className={`w-12 h-1.5 ${dark ? 'bg-white/20 hover:bg-white/30' : 'bg-black/20 hover:bg-black/30'} rounded-full mx-auto mb-4 sm:hidden mt-2 cursor-pointer transition-colors`}
              onClick={onClose}
              aria-label="Close modal"
              role="button"
              tabIndex={0}
            />
            
            {/* Header */}
            <div className={`px-4 sm:px-5 pb-2 sm:pb-3 border-b ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'} mb-3 sm:mb-4`}>
              <h3 
                id="share-modal-title"
                className={`${dark ? 'text-white' : 'text-[#111111]'} font-bold text-center text-base`}
              >
                Share to
              </h3>
            </div>
            
            {/* Platforms Grid */}
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5 px-4 sm:px-5" role="list" aria-label="Share platforms">
              {platforms.map((p, index) => (
                <button 
                  key={p.id}
                  ref={index === 0 ? firstButtonRef : null}
                  onClick={() => handleShare(p.id)}
                  onKeyDown={(e) => handleKeyDown(e, () => handleShare(p.id))}
                  className={`flex flex-col items-center justify-center gap-2 p-2.5 sm:p-3 rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30 ${p.color} ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  role="listitem"
                  aria-label={`Share to ${p.name}`}
                  disabled={isSharing}
                >
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full ${dark ? 'bg-white/10' : 'bg-black/5'} flex items-center justify-center`}>
                    {p.icon}
                  </div>
                  <span className={`text-[10px] sm:text-[11px] font-medium ${dark ? 'text-white/60' : 'text-[#666666]'} text-center`}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Cancel Button */}
            <div className={`px-4 sm:px-5 pt-4 sm:pt-5 mt-2 border-t ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'}`}>
              <button
                onClick={onClose}
                onKeyDown={(e) => handleKeyDown(e, onClose)}
                className={`w-full py-2.5 sm:py-3 rounded-full ${dark ? 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white' : 'bg-black/5 text-[#8A8A8F] hover:bg-black/10 hover:text-[#111111]'} font-semibold text-[13px] sm:text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-black/20`}
                aria-label="Cancel share"
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

export default ShareModal;