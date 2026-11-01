import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Video, Image } from 'lucide-react';

const UploadEntry = ({ onUpload, onRecord, onGallery }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-6"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-8"
      >
        <Video className="w-12 h-12 text-primary" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-3xl font-bold text-white text-center mb-3"
      >
        Create a video
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-gray-400 text-center mb-12 text-lg"
      >
        Share a moment with your followers.
      </motion.p>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="w-full max-w-sm space-y-4"
      >
        {/* Upload Video */}
        <button
          onClick={onUpload}
          className="w-full bg-gradient-to-r from-primary to-secondary text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-98 shadow-lg shadow-primary/25"
        >
          <Upload className="w-5 h-5" />
          Upload Video
        </button>

        {/* Record Video */}
        <button
          onClick={onRecord}
          className="w-full bg-white/10 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-white/15 transition-all active:scale-98 border border-white/10"
        >
          <Video className="w-5 h-5" />
          Record Video
        </button>

        {/* Choose from Gallery */}
        <button
          onClick={onGallery}
          className="w-full bg-white/5 text-gray-300 font-medium py-4 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-98 border border-white/5"
        >
          <Image className="w-5 h-5" />
          Choose from Gallery
        </button>
      </motion.div>

      {/* Info Text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="text-gray-500 text-xs text-center mt-8"
      >
        MP4, MOV, WebM • Max 500 MB
      </motion.p>
    </motion.div>
  );
};

export default UploadEntry;