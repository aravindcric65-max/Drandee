import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Music, Type, Wand2, SlidersHorizontal, Image as ImageIcon, ChevronLeft, ArrowRight, Settings, Crop } from 'lucide-react';
import { EffectsPicker, FiltersPicker, TextEditor, AdjustmentsPanel, SettingsPanel, SoundPanel, CoverSelector } from './ContextualTools';
import CropPanel from './CropPanel';
import { getCssFilterString } from '../../utils/filterEngine';

const VideoEditor = ({ mediaItems, initialSettings, onBack, onNext }) => {
  const [activeTool, setActiveTool] = useState(null); // 'effects', 'filters', 'text', 'adjust', 'sound', 'cover', 'settings', 'crop'
  const [settings, setSettings] = useState(initialSettings || { edits: {} });
  
  const videoRef = useRef(null);
  
  const currentItem = mediaItems[0];
  const isVideo = currentItem?.file?.type?.startsWith('video/');

  const tools = [
    { id: 'sound', icon: Music, label: 'Sound' },
    { id: 'effects', icon: Wand2, label: 'Effects' },
    { id: 'filters', icon: ImageIcon, label: 'Filters' },
    { id: 'adjust', icon: SlidersHorizontal, label: 'Adjust' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'crop', icon: Crop, label: 'Crop' },
  ];

  const handleNext = () => {
    onNext(settings);
  };

  const handleCropSave = (cropState) => {
    setSettings(prev => ({
      ...prev,
      edits: { ...prev.edits, crop: cropState }
    }));
    setActiveTool(null);
  };

  // Render crop panel on top if active
  if (activeTool === 'crop') {
    return (
      <AnimatePresence>
        <CropPanel 
          mediaUrl={currentItem.url}
          mediaType={currentItem.file.type}
          initialCropState={settings.edits?.crop}
          onSave={handleCropSave}
          onCancel={() => setActiveTool(null)}
        />
      </AnimatePresence>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[1000]">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[2000] flex items-center justify-between p-4 pt-safe bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md cursor-pointer">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTool('settings')}
            className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-md"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
          <button 
            onClick={handleNext}
            className="px-4 py-2 bg-primary text-white rounded-full font-semibold flex items-center gap-1 shadow-lg"
          >
            <span>Next</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {isVideo ? (
          <video 
            ref={videoRef}
            src={currentItem.url} 
            className="w-full h-full object-contain transition-all duration-200"
            style={{ 
              filter: getCssFilterString(settings.edits?.filter, settings.edits?.adjustments),
              transform: settings.edits?.crop ? `scale(${settings.edits.crop.zoom}) rotate(${settings.edits.crop.rotation}deg)` : 'none'
            }}
            loop
            autoPlay
            playsInline
            muted
          />
        ) : (
          <img 
            src={currentItem?.url} 
            alt="preview" 
            className="w-full h-full object-contain transition-all duration-200"
            style={{ 
              filter: getCssFilterString(settings.edits?.filter, settings.edits?.adjustments),
              transform: settings.edits?.crop ? `scale(${settings.edits.crop.zoom}) rotate(${settings.edits.crop.rotation}deg)` : 'none'
            }}
          />
        )}
        
        {/* Render Text Overlay */}
        {settings.edits?.textOverlay && (
          <div 
            className="absolute z-10 font-bold text-2xl text-center px-4 w-full break-words drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none"
            style={{ color: settings.edits.textOverlay.color, top: '50%', transform: 'translateY(-50%)' }}
          >
            {settings.edits.textOverlay.content}
          </div>
        )}
      </div>

      {/* Right Sidebar Tools */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[2000] pointer-events-auto">
        {tools.map(tool => (
          <button 
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className="flex flex-col items-center gap-1 drop-shadow-md cursor-pointer"
          >
            <div className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:border-primary/50 transition-colors pointer-events-auto">
              <tool.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-medium text-white shadow-black">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom Timeline (Simplified) */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end pb-safe px-4">
        <div className="w-full h-12 bg-white/10 rounded-lg overflow-hidden border border-white/20 relative">
           <div className="absolute top-0 bottom-0 left-[20%] right-[20%] border-2 border-primary rounded-md bg-white/5" />
        </div>
      </div>

      {/* Contextual Panels */}
      <AnimatePresence>
        {activeTool === 'settings' && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setActiveTool(null)} />}
        {activeTool === 'effects' && <EffectsPicker settings={settings} setSettings={setSettings} onClose={() => setActiveTool(null)} />}
        {activeTool === 'filters' && <FiltersPicker settings={settings} setSettings={setSettings} onClose={() => setActiveTool(null)} />}
        {activeTool === 'text' && <TextEditor settings={settings} setSettings={setSettings} onClose={() => setActiveTool(null)} />}
        {activeTool === 'adjust' && <AdjustmentsPanel settings={settings} setSettings={setSettings} onClose={() => setActiveTool(null)} />}
        {activeTool === 'sound' && <SoundPanel settings={settings} setSettings={setSettings} onClose={() => setActiveTool(null)} />}
        {activeTool === 'cover' && (
          <CoverSelector 
            videoFile={currentItem?.file}
            selectedFrame={settings.coverTime}
            onChange={(url, time) => setSettings(prev => ({ ...prev, cover: url, coverTime: time }))}
            onClose={() => setActiveTool(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoEditor;