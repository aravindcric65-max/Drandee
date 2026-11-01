import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, X, CheckCircle, AlertCircle, Wifi } from 'lucide-react';

const UploadProgress = ({ 
  fileName, 
  fileSize, 
  totalSize, 
  uploadSpeed, 
  stage, 
  progress, 
  onCancel, 
  onPause, 
  onResume,
  isPaused,
  error,
  onRetry,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStageIcon = () => {
    switch (stage) {
      case 'uploading':
        return <Wifi className="w-8 h-8 text-primary" />;
      case 'processing':
        return <CheckCircle className="w-8 h-8 text-secondary" />;
      case 'preparing':
        return <CheckCircle className="w-8 h-8 text-success" />;
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-success" />;
      case 'failed':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Wifi className="w-8 h-8 text-primary" />;
    }
  };

  const getStageText = () => {
    switch (stage) {
      case 'uploading':
        return 'Uploading video';
      case 'processing':
        return 'Processing video';
      case 'preparing':
        return 'Preparing post';
      case 'completed':
        return 'Complete!';
      case 'failed':
        return 'Upload failed';
      default:
        return 'Starting...';
    }
  };

  const stages = ['uploading', 'processing', 'preparing', 'completed'];
  const currentStageIndex = stages.indexOf(stage);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] px-6"
    >
      {/* Close Button */}
      {stage !== 'completed' && (
        <button
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-all"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      )}

      {/* Stage Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-8"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {getStageIcon()}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Stage Text */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-white text-center mb-2"
      >
        {getStageText()}
      </motion.h2>

      {/* File Info */}
      {stage !== 'completed' && stage !== 'failed' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-400 text-center mb-8"
        >
          {fileName} • {formatBytes(fileSize)} / {formatBytes(totalSize)}
        </motion.p>
      )}

      {/* Progress Ring */}
      {stage !== 'failed' && (
        <div className="relative w-48 h-48 mb-8">
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress Circle */}
            <motion.circle
              initial={{ strokeDashoffset: 552 }}
              animate={{ strokeDashoffset: 552 - (552 * progress) / 100 }}
              transition={{ duration: 0.3 }}
              cx="96"
              cy="96"
              r="88"
              stroke="url(#gradient)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="552"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#9c27b0" />
                <stop offset="100%" stopColor="#c51162" />
              </linearGradient>
            </defs>
          </svg>

          {/* Progress Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={progress}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-4xl font-bold text-white"
            >
              {progress}%
            </motion.span>
            {uploadSpeed && (
              <span className="text-gray-400 text-sm mt-1">
                {uploadSpeed} MB/s
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 max-w-sm"
        >
          <p className="text-red-400 text-sm text-center">{error}</p>
        </motion.div>
      )}

      {/* Controls */}
      {stage !== 'completed' && stage !== 'failed' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          {/* Pause/Resume */}
          <button
            onClick={isPaused ? onResume : onPause}
            className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
          >
            {isPaused ? (
              <Play className="w-6 h-6 text-white ml-0.5" />
            ) : (
              <Pause className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-500/20 transition-all"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </motion.div>
      )}

      {/* Retry Button */}
      {stage === 'failed' && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onRetry}
          className="mt-4 px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all"
        >
          Try Again
        </motion.button>
      )}

      {/* Time Elapsed */}
      {stage !== 'completed' && stage !== 'failed' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-500 text-sm mt-8"
        >
          Elapsed: {formatTime(elapsedTime)}
        </motion.p>
      )}

      {/* Stage Indicators */}
      {stage !== 'failed' && (
        <div className="flex items-center gap-2 mt-8">
          {stages.map((s, index) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                index < currentStageIndex
                  ? 'bg-primary'
                  : index === currentStageIndex
                  ? 'bg-primary scale-125'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default UploadProgress;