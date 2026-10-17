import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCcw } from 'lucide-react';

const ASPECT_RATIOS = [
  { label: 'Free', value: null },
  { label: '9:16', value: 9/16 },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4/5 },
  { label: '16:9', value: 16/9 }
];

const CropPanel = ({ mediaUrl, mediaType, initialCropState, onSave, onCancel }) => {
  const [crop, setCrop] = useState(initialCropState?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCropState?.zoom || 1);
  const [rotation, setRotation] = useState(initialCropState?.rotation || 0);
  const [aspect, setAspect] = useState(initialCropState?.aspect || 9/16);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(initialCropState?.croppedAreaPixels || null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    onSave({
      crop,
      zoom,
      rotation,
      aspect,
      croppedAreaPixels
    });
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(9/16);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-[#0a0a0f] z-[2000] flex flex-col"
    >
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 pt-safe bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={onCancel} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md">
          <X className="w-6 h-6 text-white" />
        </button>
        <span className="text-white font-bold text-lg drop-shadow-md">Crop</span>
        <button onClick={handleSave} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <Check className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 relative bg-black">
        <Cropper
          image={mediaType.startsWith('image/') ? mediaUrl : undefined}
          video={mediaType.startsWith('video/') ? mediaUrl : undefined}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
        />
      </div>

      <div className="bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 p-4 pb-safe flex flex-col gap-6">
        {/* Zoom Slider */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">Zoom</span>
          <input 
            type="range" 
            min={1} max={3} step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
        </div>
        
        {/* Rotation Slider */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">Rotate</span>
          <input 
            type="range" 
            min={0} max={360}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
        </div>

        {/* Aspect Ratios & Reset */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.label}
              onClick={() => setAspect(ratio.value)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
                aspect === ratio.value ? 'bg-primary text-white' : 'bg-white/10 text-gray-300'
              }`}
            >
              {ratio.label}
            </button>
          ))}
          <div className="w-px h-8 bg-white/20 mx-2 flex-shrink-0" />
          <button 
            onClick={handleReset}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CropPanel;
