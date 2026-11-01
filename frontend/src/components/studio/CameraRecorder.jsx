import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Video, X, Check, RotateCcw } from 'lucide-react';
import { useVideoRecorder } from '../../hooks/useVideoRecorder';

const CameraRecorder = ({ onRecordComplete, onBack }) => {
  const videoRef = useRef(null);
  const {
    isRecording,
    isPaused,
    duration,
    stream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useVideoRecorder(videoRef);

  const [recordedChunks, setRecordedChunks] = useState([]);

  const handleStart = async () => {
    await startRecording();
  };

  const handleStop = () => {
    const blob = stopRecording();
    onRecordComplete(blob);
  };

  const handlePause = () => {
    pauseRecording();
  };

  const handleResume = () => {
    resumeRecording();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10">
        <div className="flex items-center justify-between">
          <motion.button
            onClick={onBack}
            className="p-3 rounded-full bg-black/50 backdrop-blur-sm"
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-6 h-6 text-white" />
          </motion.button>

          <motion.div
            className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm"
            animate={{
              backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <span className="text-white font-mono font-bold">
              {formatTime(duration)}
            </span>
          </motion.div>

          <div className="w-12" /> {/* Spacer */}
        </div>
      </div>

      {/* Camera Preview */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Recording Indicator */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/80 backdrop-blur-sm rounded-full"
          >
            <div className="flex items-center gap-2">
              <motion.div
                className="w-3 h-3 rounded-full bg-white"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-white font-medium">Recording</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="p-8 bg-gradient-to-t from-black to-transparent">
        <div className="flex items-center justify-center gap-8">
          {!isRecording ? (
            <motion.button
              onClick={handleStart}
              className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Video className="w-10 h-10 text-white" />
            </motion.button>
          ) : (
            <>
              <motion.button
                onClick={isPaused ? handleResume : handlePause}
                className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {isPaused ? (
                  <Check className="w-8 h-8 text-white" />
                ) : (
                  <RotateCcw className="w-8 h-8 text-white" />
                )}
              </motion.button>

              <motion.button
                onClick={handleStop}
                className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <div className="w-8 h-8 rounded-sm bg-white" />
              </motion.button>
            </>
          )}
        </div>

        <p className="text-center text-white/60 mt-6 text-sm">
          {isRecording 
            ? (isPaused ? 'Tap ✓ to resume' : 'Tap ● to stop') 
            : 'Tap to start recording'}
        </p>
      </div>
    </div>
  );
};

export default CameraRecorder;