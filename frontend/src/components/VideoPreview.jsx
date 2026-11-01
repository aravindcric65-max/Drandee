import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

const VideoPreview = ({ videoUrl, thumbnailUrl, title, onCaptionGenerated }) => {
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef(null);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.div
      className="video-preview-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className="video-wrapper"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {isHovering ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="video-element"
            loop
            playsInline
          />
        ) : (
          <img
            src={thumbnailUrl || `${videoUrl}?tr=ik-thumbnail.jpg`}
            alt={title}
            loading="lazy"
            className="thumbnail-element"
          />
        )}

        <motion.div
          className="play-overlay"
          animate={{ opacity: isHovering ? 0 : 1 }}
        >
          <div className="play-button">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </motion.div>
      </div>

      <div className="video-info">
        <h3 className="video-title">{title || 'Untitled Video'}</h3>
        
        <button
          className="ai-caption-btn"
          onClick={onCaptionGenerated}
        >
          <span className="ai-icon">✨</span>
          Generate AI Caption
        </button>
      </div>

      <style jsx>{`
        .video-preview-card {
          width: 100%;
          max-width: 600px;
          margin: 40px auto;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          overflow: hidden;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .video-wrapper {
          position: relative;
          aspect-ratio: 16/9;
          background: #000;
          cursor: pointer;
          overflow: hidden;
        }

        .video-element,
        .thumbnail-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .play-button {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.5);
        }

        .play-button svg {
          width: 30px;
          height: 30px;
          color: white;
          margin-left: 4px;
        }

        .video-info {
          padding: 24px;
        }

        .video-title {
          font-size: 20px;
          font-weight: 700;
          color: white;
          margin: 0 0 16px 0;
        }

        .ai-caption-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .ai-caption-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.4);
        }

        .ai-icon {
          font-size: 18px;
        }
      `}</style>
    </motion.div>
  );
};

export default VideoPreview;