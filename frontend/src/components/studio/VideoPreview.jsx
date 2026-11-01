import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Scissors, Crop, Image, Music, RotateCcw } from 'lucide-react';

const VideoPreview = ({ videoFile, videoUrl, onNext, onBack, onReplace }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    };
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    video.currentTime = percentage * duration;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-screen bg-black"
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
        >
          <RotateCcw className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold text-lg">Preview</span>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all"
        >
          Next
        </button>
      </div>

      {/* Video Preview */}
      <div 
        className="flex-1 flex items-center justify-center relative"
        onClick={() => setShowControls(!showControls)}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-h-full max-w-full object-contain"
          onClick={togglePlay}
        />

        {/* Play/Pause Indicator */}
        {!isPlaying && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-10 h-10 text-white ml-1" />
            </div>
          </motion.div>
        )}

        {/* Bottom Controls */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent"
          >
            {/* Timeline */}
            <div
              className="h-1 bg-white/20 rounded-full mb-4 cursor-pointer"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full relative"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
              </div>
            </div>

            {/* Time & Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white" />
                  )}
                </button>
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Tool Row */}
      <div className="bg-[#0a0a0f] border-t border-white/5 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          {/* Trim */}
          <button className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-all flex-1">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Scissors className="w-6 h-6 text-gray-300" />
            </div>
            <span className="text-xs text-gray-400">Trim</span>
          </button>

          {/* Ratio */}
          <button className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-all flex-1">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Crop className="w-6 h-6 text-gray-300" />
            </div>
            <span className="text-xs text-gray-400">Ratio</span>
          </button>

          {/* Cover */}
          <button className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-all flex-1">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Image className="w-6 h-6 text-gray-300" />
            </div>
            <span className="text-xs text-gray-400">Cover</span>
          </button>

          {/* Sound */}
          <button className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-all flex-1">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Music className="w-6 h-6 text-gray-300" />
            </div>
            <span className="text-xs text-gray-400">Sound</span>
          </button>

          {/* Replace */}
          <button
            onClick={onReplace}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-red-500/10 transition-all flex-1"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-red-400" />
            </div>
            <span className="text-xs text-red-400">Replace</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoPreview;