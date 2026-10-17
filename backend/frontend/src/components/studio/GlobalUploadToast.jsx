import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUpload } from '../../context/UploadContext';
import { XIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react';

const GlobalUploadToast = () => {
  const { uploads, clearUpload } = useUpload();

  if (!uploads || uploads.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col items-center pt-safe pt-4 px-4 gap-2 pointer-events-none">
      <AnimatePresence>
        {uploads.map(upload => (
          <motion.div
            key={upload.id}
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
            className="bg-drandee-card/70 backdrop-blur-xl border border-white/20 p-3 rounded-2xl shadow-2xl flex items-center gap-3 w-full max-w-sm pointer-events-auto"
          >
            {/* Status Icon / Progress Ring */}
            <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center">
              {upload.stage === 'preparing' || upload.stage === 'uploading' || upload.stage === 'processing' ? (
                <>
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="20" cy="20" r="18" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" />
                    <circle 
                      cx="20" cy="20" r="18" 
                      stroke="#AFA9EC" strokeWidth="3" fill="none" 
                      strokeDasharray={2 * Math.PI * 18}
                      strokeDashoffset={2 * Math.PI * 18 * (1 - upload.progress / 100)}
                      className="transition-all duration-300 ease-out"
                    />
                  </svg>
                  <span className="text-[10px] font-medium">{upload.progress}%</span>
                </>
              ) : upload.stage === 'completed' ? (
                <CheckCircleIcon className="w-6 h-6 text-green-400" />
              ) : (
                <AlertCircleIcon className="w-6 h-6 text-red-400" />
              )}
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold truncate">
                {upload.stage === 'preparing' && 'Preparing post...'}
                {upload.stage === 'uploading' && 'Uploading masterpiece...'}
                {upload.stage === 'processing' && 'Polishing your post...'}
                {upload.stage === 'completed' && 'Posted successfully!'}
                {upload.stage === 'failed' && 'Upload failed'}
              </h4>
              <p className="text-xs text-white/50 truncate">
                {upload.error || (
                  upload.stage === 'completed' ? 'Ready to go viral! 🚀' :
                  upload.progress < 25 ? 'Preparing your masterpiece... 🎨' :
                  upload.progress < 50 ? 'Looking good, star! 🌟' :
                  upload.progress < 75 ? 'Almost there! Keep it up! 💎' :
                  upload.progress < 100 ? 'Finishing touches... ✨' :
                  'Processing... ⏳'
                )}
              </p>
            </div>

            {/* Dismiss/Action Button */}
            {upload.stage === 'failed' ? (
              <button 
                onClick={() => clearUpload(upload.id)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              >
                <XIcon className="w-4 h-4 text-white/70" />
              </button>
            ) : upload.stage === 'completed' ? (
              <a
                href={`/`}
                onClick={(e) => {
                  e.preventDefault();
                  clearUpload(upload.id);
                  // Just reload the page to see the new post in the feed
                  window.location.href = '/'; 
                }}
                className="ml-2 px-3 py-1.5 bg-primary/20 text-primary text-xs font-bold rounded-full hover:bg-primary/30 transition-colors flex-shrink-0"
              >
                View
              </a>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default GlobalUploadToast;
