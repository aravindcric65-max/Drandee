import React from 'react';
import { motion } from 'framer-motion';
import { Check, Play, Share2, Heart, ArrowRight } from 'lucide-react';

const UploadSuccess = ({ videoUrl, videoTitle, onViewPost, onDone, onShare }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] px-6"
    >
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-success/20 to-green-500/20 flex items-center justify-center mb-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          <Check className="w-12 h-12 text-success" />
        </motion.div>
      </motion.div>

      {/* Success Message */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-white text-center mb-3"
      >
        Video published!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-gray-400 text-center mb-8 text-lg"
      >
        Your video is now live.
      </motion.p>

      {/* Video Preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm bg-white/5 rounded-2xl overflow-hidden mb-8"
      >
        <div className="aspect-[9/16] bg-black relative">
          {videoUrl && (
            <video
              src={videoUrl}
              className="w-full h-full object-cover"
              muted
              loop
              autoPlay
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <div>
              <h3 className="text-white font-semibold mb-1">{videoTitle || 'Your Video'}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-300">
                <span className="flex items-center gap-1">
                  <Play className="w-3 h-3" /> 0
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> 0 Respects
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-sm space-y-3"
      >
        {/* View Post */}
        <button
          onClick={onViewPost}
          className="w-full bg-gradient-to-r from-primary to-secondary text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-98 shadow-lg shadow-primary/25"
        >
          View Post
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="w-full bg-white/10 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-white/15 transition-all active:scale-98 border border-white/10"
        >
          <Share2 className="w-5 h-5" />
          Share with friends
        </button>

        {/* Done */}
        <button
          onClick={onDone}
          className="w-full bg-white/5 text-gray-300 font-medium py-4 px-6 rounded-xl hover:bg-white/10 transition-all active:scale-98 border border-white/5"
        >
          Done
        </button>
      </motion.div>

      {/* Stats Preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 grid grid-cols-3 gap-6 w-full max-w-sm"
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-white">0</div>
          <div className="text-gray-500 text-xs mt-1">Views</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">0</div>
          <div className="text-gray-500 text-xs mt-1">Respects</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">0</div>
          <div className="text-gray-500 text-xs mt-1">Comments</div>
        </div>
      </motion.div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 p-4 bg-primary/10 border border-primary/20 rounded-xl max-w-sm"
      >
        <p className="text-primary text-sm text-center">
          💡 Tip: Share your video to get more respects!
        </p>
      </motion.div>
    </motion.div>
  );
};

export default UploadSuccess;