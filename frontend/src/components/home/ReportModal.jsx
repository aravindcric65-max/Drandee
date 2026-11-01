import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';

export const ReportModal = ({ isOpen, onClose, postId, dark = false }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef(null);
  const firstButtonRef = useRef(null);

  const REPORT_REASONS = useMemo(() => [
    { id: 'spam', label: 'Spam or misleading', desc: 'Irrelevant, unwanted, or commercial spam.' },
    { id: 'harassment', label: 'Harassment or bullying', desc: 'Targeted abuse or severe intimidation.' },
    { id: 'hate', label: 'Hate speech', desc: 'Slurs, racism, or attacks on protected groups.' },
    { id: 'violence', label: 'Violence or danger', desc: 'Graphic harm, self-injury, or dangerous acts.' },
    { id: 'sexual', label: 'Sexual content', desc: 'Nudity or inappropriate adult material.' },
    { id: 'false', label: 'False information', desc: 'Harmful misinformation or fake news.' }
  ], []);

  // Memoize handleCancel to fix dependency warning
  const handleCancel = useCallback(() => {
    setSelectedReason(null);
    onClose();
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
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
  }, [isOpen, handleCancel]);

  // Focus management
  useEffect(() => {
    if (isOpen && firstButtonRef.current) {
      setTimeout(() => {
        firstButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason || !postId) return;
    
    setIsSubmitting(true);
    
    try {
      await fetch(`/api/reports/post/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: selectedReason,
          category: selectedReason,
          description: REPORT_REASONS.find(r => r.id === selectedReason)?.label
        })
      });
    } catch (err) {
      console.error("Report API failed", err);
    } finally {
      setIsSubmitting(false);
      setSelectedReason(null);
      onClose();
    }
  }, [selectedReason, postId, REPORT_REASONS, onClose]);

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
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md"
          onClick={handleCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
        >
          <motion.div 
            ref={modalRef}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-md ${dark ? 'bg-[#1a1a1a]' : 'bg-[#FFFFFF]'} border-t sm:border ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'} rounded-t-[32px] sm:rounded-[28px] pb-6 pt-2 sm:pt-0 overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]`}
          >
            {/* Mobile Drag Handle */}
            <div 
              className={`w-12 h-1.5 ${dark ? 'bg-white/20 hover:bg-white/30' : 'bg-black/20 hover:bg-black/30'} rounded-full mx-auto mb-4 sm:hidden mt-2 cursor-pointer transition-colors`}
              onClick={handleCancel}
              aria-label="Close modal"
              role="button"
              tabIndex={0}
            />
            
            {/* Header */}
            <div className={`flex items-center justify-between px-5 sm:px-6 py-4 border-b ${dark ? 'border-[#252525]' : 'border-[#E8E8EC]'} sm:mt-2`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                  <ShieldAlert size={16} strokeWidth={2} />
                </div>
                <h2 
                  id="report-modal-title"
                  className={`${dark ? 'text-white' : 'text-[#111111]'} text-base sm:text-lg font-bold tracking-tight`}
                >
                  Report content
                </h2>
              </div>
              <button 
                ref={firstButtonRef}
                onClick={handleCancel}
                className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20' : 'bg-[#E8E8EC] text-[#666666] hover:text-[#111111] hover:bg-[#E8E8EC]/80'} transition-colors focus:outline-none focus:ring-2 focus:ring-[#E8E8EC]/50`}
                aria-label="Close modal"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            
            {/* Scrollable Reasons List */}
            <div 
              className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 hide-scrollbar"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}
              role="radiogroup"
              aria-label="Report reasons"
            >
              <p className={`${dark ? 'text-white/40' : 'text-[#8A8A8F]'} text-sm mb-4 px-2 font-medium`}>
                Please select the reason that best applies. Your report is kept strictly anonymous.
              </p>
              
              <div className="flex flex-col gap-1.5">
                {REPORT_REASONS.map((reason, index) => {
                  const isSelected = selectedReason === reason.id;
                  
                  return (
                    <button
                      key={reason.id}
                      ref={index === 0 ? firstButtonRef : null}
                      onClick={() => setSelectedReason(reason.id)}
                      onKeyDown={(e) => handleKeyDown(e, () => setSelectedReason(reason.id))}
                      className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
                        isSelected 
                          ? 'bg-red-500/5 border-red-500/30' 
                          : dark ? 'bg-[#252525] border-[#252525] hover:bg-white/10' : 'bg-white border-[#E8E8EC] hover:bg-black/5'
                      }`}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={reason.label}
                    >
                      {/* Custom Radio Circle */}
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'border-red-400' : dark ? 'border-[#252525] group-hover:border-white/30' : 'border-[#E8E8EC] group-hover:border-black/20'
                      }`}>
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        )}
                      </div>
                      
                      <div className="flex flex-col flex-1">
                        <span className={`font-semibold text-[14px] sm:text-[15px] mb-0.5 ${
                          isSelected ? 'text-red-500' : dark ? 'text-white group-hover:text-white/60' : 'text-[#111111] group-hover:text-[#666666]'
                        }`}>
                          {reason.label}
                        </span>
                        <span className={`${dark ? 'text-white/40' : 'text-[#8A8A8F]'} text-[12px] sm:text-[13px] leading-snug`}>
                          {reason.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div className={`px-5 sm:px-6 py-4 sm:py-5 border-t ${dark ? 'border-[#252525] bg-[#252525]' : 'border-[#E8E8EC] bg-[#F7F7F9]'} flex gap-3 sm:justify-end`}>
              <button 
                onClick={handleCancel}
                onKeyDown={(e) => handleKeyDown(e, handleCancel)}
                className={`flex-1 sm:flex-none px-5 sm:px-6 py-2.5 sm:py-3 rounded-full ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-[#111111] hover:bg-black/10'} text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-black/20 min-h-[40px]`}
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                onKeyDown={(e) => handleKeyDown(e, handleSubmit)}
                disabled={!selectedReason || isSubmitting}
                className={`flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-red-500/30 min-h-[40px] ${
                  selectedReason && !isSubmitting
                    ? 'bg-red-500 text-white hover:bg-red-500/90 active:scale-95 shadow-[0_0_20px_rgba(255,59,48,0.2)]' 
                    : 'bg-black/5 text-[#8A8A8F] cursor-not-allowed'
                }`}
                aria-label="Submit report"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
            
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReportModal;