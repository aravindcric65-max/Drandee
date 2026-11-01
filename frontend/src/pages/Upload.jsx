import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VideoUploadStudio from '../components/studio/VideoUploadStudio';

const Upload = () => {
  const [showStudio, setShowStudio] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      {!showStudio && <>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/90 backdrop-blur-lg border-b border-[#E8E8EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-[#111111]">Upload</h1>
            <button
              onClick={() => setShowStudio(true)}
              className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all active:scale-98"
            >
              Create Video
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {/* Icon */}
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
              />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-4xl font-bold text-[#111111] mb-4">
            Create & Share Videos
          </h2>

          {/* Subtitle */}
          <p className="text-[#666666] text-lg mb-8 max-w-2xl mx-auto">
            Upload your videos, add music, captions, and share with your followers.
            It's easy and fun!
          </p>

          {/* CTA Button */}
          <button
            onClick={() => setShowStudio(true)}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl hover:opacity-90 transition-all active:scale-98 shadow-lg shadow-primary/25"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Start Creating
          </button>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                ),
                title: 'Upload Videos',
                description: 'Upload up to 500MB in MP4, MOV, or WebM format',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                ),
                title: 'Add Music',
                description: 'Choose from our library of royalty-free tracks',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12H4m1 0a1 1 0 110 2H6a1 1 0 110-2H6zm1 0a1 1 0 110 2h-1a1 1 0 110-2h1zm1 0a1 1 0 110 2H9a1 1 0 110-2h1zM19 12a1 1 0 110 2h-1a1 1 0 110-2h1zm1 0a1 1 0 110 2h-1a1 1 0 110-2h1zm-9-8a1 1 0 110 2H9a1 1 0 110-2h1zm1 0a1 1 0 110 2h-1a1 1 0 110-2h1z" />
                  </svg>
                ),
                title: 'Smart Captions',
                description: 'AI-powered caption suggestions and hashtags',
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#F7F7F9] rounded-2xl p-6 border border-[#E8E8EC]"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-[#111111] font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-[#666666]">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
      </>}

      {/* Upload Studio Modal */}
      <AnimatePresence>
        {showStudio && (
          <VideoUploadStudio onClose={() => setShowStudio(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Upload;