import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({ progress, status = 'uploading' }) => {
  return (
    <div className="progress-container">
      <div className="progress-info">
        <span className="progress-status">
          {status === 'uploading' && '⬆️ Uploading...'}
          {status === 'processing' && '🎬 Processing...'}
          {status === 'complete' && '✅ Complete!'}
        </span>
        <span className="progress-percentage">{Math.round(progress)}%</span>
      </div>

      <div className="progress-bar-wrapper">
        <motion.div
          className="progress-bar"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <motion.div
            className="progress-glow"
            animate={{
              x: [0, 100, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>
      </div>

      <style jsx>{`
        .progress-container {
          width: 100%;
          max-width: 600px;
          margin: 40px auto;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .progress-status {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .progress-percentage {
          font-size: 14px;
          font-weight: 700;
          color: #6366f1;
        }

        .progress-bar-wrapper {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #a855f7);
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }

        .progress-glow {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.5),
            transparent
          );
        }
      `}</style>
    </div>
  );
};

export default ProgressBar;