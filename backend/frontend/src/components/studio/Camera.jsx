import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCcw, Zap, Timer, Settings2, Sparkles, Image as ImageIcon } from 'lucide-react';

const Camera = ({ onClose, onRecordComplete, onGalleryClick }) => {
  const [permission, setPermission] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState('user');
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Request permissions and start stream
  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPermission('granted');
    } catch (err) {
      console.error('Camera access error:', err);
      setPermission('denied');
    }
  }, [facingMode]);

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, [startStream]);

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleStartRecording = () => {
    if (!videoRef.current?.srcObject) return;
    
    chunksRef.current = [];
    const stream = videoRef.current.srcObject;
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
      onRecordComplete(file);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 60) {
          handleStopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  if (permission === 'denied') {
    return (
      <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <line x1="2" y1="2" x2="22" y2="22" stroke="red" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-4">Camera access needed</h2>
        <p className="text-gray-400 text-center mb-8">We need access to your camera and microphone to record videos.</p>
        <button 
          onClick={onClose}
          className="px-8 py-4 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-colors w-full max-w-sm mb-4"
        >
          Not Now
        </button>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-primary text-white rounded-full font-semibold hover:bg-primary/90 transition-colors w-full max-w-sm"
        >
          Open Settings
        </button>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (recordingTime / 60) * 100;

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 bg-black z-[1000] flex flex-col"
    >
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
      />

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 pt-safe flex justify-between items-start bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md">
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="flex flex-col gap-4">
          <button onClick={toggleCamera} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md">
            <RefreshCcw className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md">
            <Zap className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md">
            <Timer className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Recording Time */}
      {isRecording && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-red-500/80 backdrop-blur-md flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white font-medium font-mono">{formatTime(recordingTime)}</span>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
        
        {/* Secondary Tools */}
        <div className="flex justify-between items-center mb-8 px-4">
          <button className="flex flex-col items-center gap-1">
            <Sparkles className="w-6 h-6 text-white" />
            <span className="text-xs text-white">Effects</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <Settings2 className="w-6 h-6 text-white" />
            <span className="text-xs text-white">Filters</span>
          </button>
        </div>

        {/* Primary Record Area */}
        <div className="flex justify-between items-center relative h-24">
          
          <button 
            onClick={onGalleryClick}
            className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20"
          >
            <ImageIcon className="w-6 h-6 text-white" />
          </button>

          {/* Record Button */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            {/* Progress Ring */}
            {isRecording && (
              <svg className="absolute w-[100px] h-[100px] -rotate-90">
                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                <circle 
                  cx="50" cy="50" r="48" 
                  fill="none" 
                  stroke="var(--primary, #9c27b0)" 
                  strokeWidth="4" 
                  strokeDasharray={`${progressPercentage * 3.01} 301`} 
                  strokeLinecap="round" 
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            )}
            
            <button
              onPointerDown={handleStartRecording}
              onPointerUp={handleStopRecording}
              onPointerLeave={handleStopRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording ? 'bg-primary scale-90' : 'bg-white border-[6px] border-white/30'
              }`}
            >
              {isRecording && <div className="w-6 h-6 rounded-sm bg-white" />}
            </button>
          </div>

          <div className="w-12" /> {/* Spacer to balance gallery button */}
        </div>
      </div>
    </motion.div>
  );
};

export default Camera;
