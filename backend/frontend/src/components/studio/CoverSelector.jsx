import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CoverSelector = ({ videoFile, selectedFrame, onChange }) => {
  const [thumbnails, setThumbnails] = useState([]);

  useEffect(() => {
    // Generate thumbnails from video
    const generateThumbnails = async () => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      
      video.onloadedmetadata = () => {
        const frames = [];
        const interval = video.duration / 5; // 5 frames
        
        for (let i = 0; i < 5; i++) {
          frames.push({
            time: i * interval,
            url: null,
          });
        }
        
        setThumbnails(frames);
      };
    };

    generateThumbnails();
  }, [videoFile]);

  return (
    <div className="mt-4">
      <h3 className="text-white font-semibold mb-3">Cover Frame</h3>
      <div className="grid grid-cols-5 gap-2">
        {thumbnails.map((thumb, index) => (
          <motion.button
            key={index}
            onClick={() => onChange(thumb.time)}
            className={`aspect-[9/16] rounded-xl overflow-hidden border-2 transition-colors
              ${selectedFrame === thumb.time
                ? 'border-primary'
                : 'border-bgBorder'}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="w-full h-full bg-bgCard flex items-center justify-center">
              <span className="text-textSecondary text-xs">Frame {index + 1}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default CoverSelector;