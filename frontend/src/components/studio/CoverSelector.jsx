import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CoverSelector = ({ videoFile, selectedFrame, onChange }) => {
  const [thumbnails, setThumbnails] = useState([]);

  useEffect(() => {
    // Generate thumbnails from video
    const generateThumbnails = async () => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.crossOrigin = 'anonymous';
      
      video.onloadedmetadata = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 90;
        canvas.height = 160; // 9:16 aspect ratio
        
        const frames = [];
        const interval = video.duration / 5; // 5 frames
        
        for (let i = 0; i < 5; i++) {
          const time = i * interval;
          
          try {
            await new Promise((resolve, reject) => {
              video.currentTime = time;
              video.onseeked = () => {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                frames.push({ time, url: dataUrl });
                resolve();
              };
              video.onerror = reject;
            });
          } catch (err) {
            console.error('Frame capture error:', err);
            frames.push({ time, url: null });
          }
        }
        
        setThumbnails(frames);
        URL.revokeObjectURL(video.src);
      };
    };

    if (videoFile) {
      generateThumbnails();
    }
  }, [videoFile]);

  return (
    <div className="mt-4">
      <h3 className="text-white font-semibold mb-3">Cover Frame</h3>
      <div className="grid grid-cols-5 gap-2">
        {thumbnails.map((thumb, index) => (
          <motion.button
            key={index}
            onClick={() => onChange(thumb.url, thumb.time)}
            className={`aspect-[9/16] rounded-xl overflow-hidden border-2 transition-colors
              ${selectedFrame === thumb.time
                ? 'border-primary'
                : 'border-bgBorder'}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {thumb.url ? (
              <img src={thumb.url} alt={`Frame ${index + 1}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-bgCard flex items-center justify-center">
                <span className="text-textSecondary text-xs">Frame {index + 1}</span>
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default CoverSelector;