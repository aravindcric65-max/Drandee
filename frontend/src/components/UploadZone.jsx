import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';

const UploadZone = ({ onFileSelect, isUploading }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleDragEnter = () => setIsDragOver(true);
  const handleDragLeave = () => setIsDragOver(false);

  return (
    <div className="upload-zone-container">
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            className="glow-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <motion.div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <input {...getInputProps()} />
        
        <motion.div
          className="upload-content"
          animate={{
            y: isDragActive ? -10 : 0,
          }}
        >
          <div className="upload-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <h3 className="upload-title">
            {isDragActive ? 'Drop your video here' : 'Drag & drop your video'}
          </h3>
          
          <p className="upload-subtitle">
            or click to browse (MP4, MOV, AVI, WebM)
          </p>

          <motion.div
            className="upload-hint"
            animate={{
              opacity: isDragActive ? 1 : 0.7,
            }}
          >
            <span className="hint-dot"></span>
            <span className="hint-dot"></span>
            <span className="hint-dot"></span>
          </motion.div>
        </motion.div>
      </motion.div>

      <style jsx>{`
        .upload-zone-container {
          position: relative;
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .glow-overlay {
          position: absolute;
          top: -20px;
          left: -20px;
          right: -20px;
          bottom: -20px;
          background: radial-gradient(
            circle,
            rgba(99, 102, 241, 0.3) 0%,
            rgba(168, 85, 247, 0.1) 50%,
            transparent 70%
          );
          border-radius: 24px;
          z-index: -1;
          filter: blur(20px);
        }

        .upload-zone {
          position: relative;
          border: 2px dashed rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          padding: 60px 40px;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          backdrop-filter: blur(10px);
          cursor: pointer;
          transition: all 0.3s ease;
          overflow: hidden;
        }

        .upload-zone.drag-active {
          border-color: #6366f1;
          background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.1) 0%,
            rgba(168, 85, 247, 0.05) 100%
          );
          transform: scale(1.02);
        }

        .upload-zone::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(99, 102, 241, 0.1),
            transparent
          );
          transition: left 0.5s ease;
        }

        .upload-zone.drag-active::before {
          left: 100%;
        }

        .upload-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .upload-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3);
        }

        .upload-icon svg {
          width: 40px;
          height: 40px;
          color: white;
        }

        .upload-title {
          font-size: 24px;
          font-weight: 700;
          color: white;
          margin: 0;
          text-align: center;
        }

        .upload-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          text-align: center;
        }

        .upload-hint {
          display: flex;
          gap: 8px;
          margin-top: 20px;
        }

        .hint-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6366f1;
          animation: pulse 1.5s infinite;
        }

        .hint-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .hint-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default UploadZone;