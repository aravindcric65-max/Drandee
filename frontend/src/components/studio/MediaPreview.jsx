import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Crop, Trash2, ArrowRight } from 'lucide-react';

const MediaPreview = ({ mediaItems, onCancel, onNext }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [items, setItems] = useState(mediaItems || []);
  const videoRef = useRef(null);

  useEffect(() => {
    // Stop playing when changing items
    setIsPlaying(false);
  }, [currentIndex]);

  if (!items || items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex];
  const isVideo = currentItem.file.type.startsWith('video/');

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleRemoveCurrent = () => {
    const newItems = [...items];
    const removed = newItems.splice(currentIndex, 1)[0];
    URL.revokeObjectURL(removed.url); // Clean up
    
    if (newItems.length === 0) {
      onCancel(); // No items left, go back
    } else {
      setItems(newItems);
      if (currentIndex >= newItems.length) {
        setCurrentIndex(newItems.length - 1);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0a0a0f] z-[9999] flex flex-col pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 pt-safe bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md">
          <X className="w-6 h-6 text-white" />
        </button>
        
        {items.length > 1 && (
          <div className="text-white font-medium text-sm bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
            {currentIndex + 1} of {items.length}
          </div>
        )}

        <button 
          onClick={(e) => { e.stopPropagation(); onNext(items); }}
          className="px-4 py-2 bg-primary text-white rounded-full font-semibold flex items-center gap-1 shadow-lg pointer-events-auto"
        >
          <span>Next</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <>
            <video 
              ref={videoRef}
              src={currentItem.url} 
              className="w-full h-full object-contain"
              loop
              playsInline
              onEnded={() => setIsPlaying(false)}
            />
            <button 
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              {!isPlaying && (
                <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm text-white">
                  <Play className="w-8 h-8 ml-1" />
                </div>
              )}
            </button>
          </>
        ) : (
          <img 
            src={currentItem.url} 
            alt="preview" 
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-50 pb-safe bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pointer-events-auto">
        
        {/* Filmstrip (if multiple items) */}
        {items.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar">
            {items.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setCurrentIndex(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                  idx === currentIndex ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                {item.file.type.startsWith('video/') ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url} alt="thumbnail" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex justify-around items-center pt-2">
          {/* We'll handle cropping mostly in the editor, but this button can trigger it if needed later */}
          <button onClick={(e) => { e.stopPropagation(); onNext(items, 'crop'); }} className="flex flex-col items-center gap-1 p-2 pointer-events-auto">
            <Crop className="w-6 h-6 text-white" />
            <span className="text-[10px] text-white">Crop</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleRemoveCurrent(); }}
            className="flex flex-col items-center gap-1 p-2 text-red-400 hover:text-red-300 transition-colors pointer-events-auto"
          >
            <Trash2 className="w-6 h-6" />
            <span className="text-[10px]">Delete</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default MediaPreview;
