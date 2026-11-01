import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserContext } from '../../context/UserContext';
import { BookmarkSolidIcon, BookmarkSmIcon, ChevSmIcon } from '../reels/ReelsIcons';

const modalVariants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.2 } }
};

export const SaveModal = ({ isOpen, onClose, postId }) => {
  const { savePost } = useContext(UserContext) || {};
  const [collectionName, setCollectionName] = useState('');

  useEffect(() => {
    if (isOpen) setCollectionName('');
  }, [isOpen]);

  const handleConfirmSave = (quickName) => {
    if (!postId) return;
    const colName = quickName || collectionName.trim() || 'Saved';
    savePost && savePost(postId, colName);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/20" onClick={onClose}>
          <motion.div 
            variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[420px] bg-[var(--bg-primary)] border-t sm:border border-[var(--border)] rounded-t-[28px] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden relative"
          >
            <div className="w-full pt-4 pb-3 flex flex-col items-center border-b border-[var(--border)] relative shrink-0 bg-[var(--bg-secondary)]">
              <div className="w-10 h-1.5 bg-black/20 rounded-full mb-3 sm:hidden cursor-pointer" onClick={onClose} />
              <h3 className="text-[var(--text-primary)] font-bold text-base tracking-wide">Save post</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
              <button 
                type="button" 
                className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 p-4 rounded-[16px] transition-colors"
                onClick={() => handleConfirmSave("Saved")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#7F77DD]/20 flex items-center justify-center text-[#7F77DD]">
                    <BookmarkSolidIcon />
                  </div>
                  <div className="text-left">
                    <div className="text-[var(--text-primary)] font-bold text-[15px]">Save to general</div>
                    <div className="text-[var(--text-secondary)] text-[12px] font-medium">Added to your Saved list</div>
                  </div>
                </div>
                <div className="text-white/30"><ChevSmIcon /></div>
              </button>

              <div className="flex items-center gap-3 opacity-50">
                <div className="h-[1px] flex-1 bg-white/20" />
                <span className="text-[12px] font-semibold tracking-wide uppercase">or name your collection</span>
                <div className="h-[1px] flex-1 bg-white/20" />
              </div>

              <div className="flex flex-col gap-2">
                <input 
                  type="text" 
                  placeholder="e.g. Travel inspo, Cooking ideas..." 
                  value={collectionName} 
                  onChange={(e) => setCollectionName(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && collectionName.trim() && handleConfirmSave()}
                  className="w-full bg-white/5 border border-white/10 rounded-[12px] p-4 text-[15px] font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-[#7F77DD]/50 transition-colors"
                  autoFocus
                />
                {collectionName.trim() && (
                  <div className="flex items-center gap-1.5 px-1 mt-1 text-[12px] text-white/50 font-medium">
                    <BookmarkSmIcon />
                    <span>Will save to <b className="text-[#AFA9EC]">"{collectionName.trim()}"</b></span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <button 
                  type="button" 
                  className="w-full bg-[#7F77DD] text-white rounded-[14px] p-4 text-[15px] font-bold disabled:opacity-40 transition-opacity"
                  onClick={() => handleConfirmSave()} 
                  disabled={!collectionName.trim()}
                >
                  Save to "{collectionName.trim() || "collection"}"
                </button>
                <button 
                  type="button" 
                  className="w-full bg-white/5 text-white/70 hover:bg-white/10 rounded-[14px] p-4 text-[15px] font-bold transition-colors"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SaveModal;
