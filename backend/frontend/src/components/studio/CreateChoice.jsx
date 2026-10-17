import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CreateChoice = ({ isOpen, onClose, onSelectType }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
          />
          
          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[1001] bg-[#0f1016] rounded-t-3xl overflow-hidden pb-safe max-w-[600px] mx-auto border-t border-white/10"
          >
            <div className="p-6">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white text-center mb-8">What do you want to create?</h2>
              
              <div className="flex gap-3">
                {/* Video Button */}
                <button
                  onClick={() => onSelectType('video')}
                  className="flex-1 flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 hover:border-primary/50 group"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"></polygon>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                  </div>
                  <span className="text-white font-semibold text-base">Video</span>
                </button>

                {/* Image Button */}
                <button
                  onClick={() => onSelectType('image')}
                  className="flex-1 flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 hover:border-primary/50 group"
                >
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <span className="text-white font-semibold text-base">Image</span>
                </button>

                {/* Text Button */}
                <button
                  onClick={() => onSelectType('text')}
                  className="flex-1 flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 hover:border-primary/50 group"
                >
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 7 4 4 20 4 20 7"></polyline>
                      <line x1="9" y1="20" x2="15" y2="20"></line>
                      <line x1="12" y1="4" x2="12" y2="20"></line>
                    </svg>
                  </div>
                  <span className="text-white font-semibold text-base">Text</span>
                </button>
              </div>
              
              <button 
                onClick={onClose}
                className="w-full mt-6 py-4 text-gray-400 font-semibold hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateChoice;
