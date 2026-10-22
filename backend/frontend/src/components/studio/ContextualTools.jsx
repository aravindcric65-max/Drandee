import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Search } from 'lucide-react';
import { PRESET_FILTERS } from '../../utils/filterEngine';
import RealCoverSelector from './CoverSelector';

const ContextualPanel = ({ title, onClose, children }) => (
  <motion.div 
    initial={{ y: '100%' }}
    animate={{ y: 0 }}
    exit={{ y: '100%' }}
    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    className="absolute bottom-0 left-0 right-0 max-h-[50vh] bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl flex flex-col z-[100]"
  >
    <div className="flex justify-between items-center p-4 border-b border-white/10">
      <h3 className="text-white font-bold text-lg">{title}</h3>
      <button onClick={onClose} className="text-primary font-semibold">Done</button>
    </div>
    <div className="overflow-y-auto p-4 flex-1 hide-scrollbar pb-safe">
      {children}
    </div>
  </motion.div>
);

export const FiltersPicker = ({ settings, setSettings, onClose }) => {
  const currentFilter = settings.edits?.filter || 'Original';

  const handleSelect = (filterName) => {
    setSettings(prev => ({
      ...prev,
      edits: { ...prev.edits, filter: filterName }
    }));
  };

  return (
    <ContextualPanel title="Filters" onClose={onClose}>
      <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
        {Object.keys(PRESET_FILTERS).map(name => (
          <button 
            key={name}
            onClick={() => handleSelect(name)}
            className="flex flex-col items-center gap-2 min-w-[80px] group"
          >
            <div className={`w-16 h-20 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 border-2 transition-all shadow-md group-hover:shadow-primary/20 group-hover:scale-105 ${currentFilter === name ? 'border-primary shadow-primary/40' : 'border-white/5'}`} />
            <span className={`text-xs transition-colors ${currentFilter === name ? 'text-primary font-bold' : 'text-gray-400 group-hover:text-gray-300'}`}>{name}</span>
          </button>
        ))}
      </div>
    </ContextualPanel>
  );
};

export const AdjustmentsPanel = ({ settings, setSettings, onClose }) => {
  const defaultAdjustments = { brightness: 100, contrast: 100, saturation: 100, exposure: 100, temperature: 0, highlights: 0, shadows: 0, sharpness: 0 };
  const currentAdj = settings.edits?.adjustments || defaultAdjustments;

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      edits: {
        ...prev.edits,
        adjustments: { ...prev.edits?.adjustments, [key]: value }
      }
    }));
  };

  const handleReset = () => {
    setSettings(prev => ({ ...prev, edits: { ...prev.edits, adjustments: defaultAdjustments } }));
  };

  const Slider = ({ label, objKey, min, max }) => (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{currentAdj[objKey]}</span>
      </div>
      <input 
        type="range" 
        min={min} max={max} 
        value={currentAdj[objKey] || min}
        onChange={(e) => handleChange(objKey, parseInt(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );

  return (
    <ContextualPanel title="Adjustments" onClose={onClose}>
      <button onClick={handleReset} className="w-full text-center text-red-400 text-sm mb-4 py-2 bg-white/5 rounded-lg">Reset All</button>
      <Slider label="Brightness" objKey="brightness" min="0" max="200" />
      <Slider label="Contrast" objKey="contrast" min="0" max="200" />
      <Slider label="Saturation" objKey="saturation" min="0" max="200" />
      <Slider label="Exposure" objKey="exposure" min="0" max="200" />
    </ContextualPanel>
  );
};

const EFFECTS = [
  { name: 'None', class: '' },
  { name: 'Vignette', class: 'shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]' },
  { name: 'Glow', class: 'drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' },
  { name: 'Sepia', class: 'sepia-[.5]' },
  { name: 'Invert', class: 'invert' }
];

export const EffectsPicker = ({ settings, setSettings, onClose }) => {
  const currentEffect = settings.edits?.effects || 'None';

  return (
    <ContextualPanel title="Effects" onClose={onClose}>
      <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
        {EFFECTS.map(effect => (
          <button 
            key={effect.name}
            onClick={() => setSettings(prev => ({ ...prev, edits: { ...prev.edits, effects: effect.name } }))}
            className="flex flex-col items-center gap-2 min-w-[80px] group"
          >
            <div className={`w-16 h-20 rounded-xl bg-gradient-to-tr from-gray-800 to-black border-2 transition-all flex items-center justify-center shadow-lg group-hover:scale-105 group-hover:shadow-primary/30 ${currentEffect === effect.name ? 'border-primary shadow-primary/40' : 'border-white/10'} ${effect.class}`}>
              <span className={`text-xs font-bold transition-colors ${currentEffect === effect.name ? 'text-primary' : 'text-white/30 group-hover:text-white/50'}`}>FX</span>
            </div>
            <span className={`text-xs transition-colors ${currentEffect === effect.name ? 'text-primary font-bold' : 'text-gray-400 group-hover:text-gray-300'}`}>{effect.name}</span>
          </button>
        ))}
      </div>
    </ContextualPanel>
  );
};

const TEXT_COLORS = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

export const TextEditor = ({ settings, setSettings, onClose }) => {
  const [text, setText] = useState(settings.edits?.textOverlay?.content || '');
  const [color, setColor] = useState(settings.edits?.textOverlay?.color || '#ffffff');

  const handleSave = () => {
    setSettings(prev => ({
      ...prev,
      edits: {
        ...prev.edits,
        textOverlay: text.trim() ? { content: text.trim(), color } : null
      }
    }));
    onClose();
  };

  return (
    <ContextualPanel title="Text Overlay" onClose={handleSave}>
      <div className="flex flex-col gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your text here..."
          className="w-full h-24 bg-white/10 rounded-lg p-3 text-white placeholder-gray-400 outline-none focus:bg-white/20 resize-none font-bold text-center"
          style={{ color }}
          autoFocus
        />
        
        <div>
          <p className="text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Select Color</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`shrink-0 w-8 h-8 rounded-full border-2 ${color === c ? 'border-primary scale-110' : 'border-transparent'} shadow-lg transition-all`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </ContextualPanel>
  );
};

export const SettingsPanel = ({ settings, setSettings, onClose }) => {
  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <ContextualPanel title="Editor Settings" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex justify-between items-center text-white">
          <span>Allow Comments</span>
          <input type="checkbox" checked={settings.allowComments} onChange={() => toggleSetting('allowComments')} className="accent-primary w-5 h-5" />
        </label>
        <label className="flex justify-between items-center text-white">
          <span>Allow Duet</span>
          <input type="checkbox" checked={settings.allowDuet} onChange={() => toggleSetting('allowDuet')} className="accent-primary w-5 h-5" />
        </label>
        <label className="flex justify-between items-center text-white">
          <span>Allow Sharing</span>
          <input type="checkbox" checked={settings.allowSharing} onChange={() => toggleSetting('allowSharing')} className="accent-primary w-5 h-5" />
        </label>
      </div>
    </ContextualPanel>
  );
};

export const SoundPanel = ({ settings, setSettings, onClose }) => {
  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const audioRef = useRef(null);

  useEffect(() => {
    const fetchAudios = async () => {
      setLoading(true);
      try {
        // Use browser language as a proxy for user's language preference
        const lang = navigator.language || 'en';
        const url = `/api/audio/trending?language=${encodeURIComponent(lang)}&query=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setAudios(data.audios);
        }
      } catch (err) {
        console.error("Failed to load audio", err);
      } finally {
        setLoading(false);
      }
    };
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchAudios();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleRowClick = (audio) => {
    if (audioRef.current) {
      if (playingId === audio.id) {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
          setPlayingId(null);
        } else {
          audioRef.current.play();
        }
      } else {
        audioRef.current.src = audio.audio_url;
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        setPlayingId(audio.id);
      }
    }
  };

  const handleSelect = (audio, e) => {
    e.stopPropagation();
    setSettings(prev => ({ ...prev, sound: audio }));
    onClose();
  };

  return (
    <ContextualPanel title="Sound Library" onClose={onClose}>
      <div className="mb-4 sticky top-0 bg-[#0a0a0f]/95 z-10 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search sounds..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 outline-none focus:bg-white/20 transition-colors"
          />
        </div>
      </div>
      
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {loading && audios.length === 0 ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {audios.map(audio => {
            const isPlaying = playingId === audio.id;
            const isSelected = settings?.sound?.id === audio.id;
            
            return (
              <div 
                key={audio.id} 
                onClick={() => handleRowClick(audio)}
                className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group ${isPlaying ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div 
                  className="w-12 h-12 rounded-lg bg-gray-800 bg-cover bg-center relative overflow-hidden flex-shrink-0"
                  style={{ backgroundImage: `url(${audio.thumbnail_url})` }}
                >
                  <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isPlaying ? <Pause className="text-white w-5 h-5" /> : <Play className="text-white w-5 h-5" />}
                  </div>
                  {isPlaying && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
                      <div className="w-1 h-3 bg-white animate-pulse rounded-full mx-0.5" />
                      <div className="w-1 h-4 bg-white animate-pulse delay-75 rounded-full mx-0.5" />
                      <div className="w-1 h-2 bg-white animate-pulse delay-150 rounded-full mx-0.5" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 overflow-hidden relative">
                  <p className={`text-sm font-semibold truncate transition-colors ${isPlaying ? 'text-primary' : 'text-white'}`}>
                    {audio.name}
                  </p>
                  
                  {/* Marquee or normal text based on playing state */}
                  <div className="w-full overflow-hidden mt-0.5">
                    {isPlaying ? (
                      <div className="animate-marquee">
                        <p className="text-primary/80 text-xs mr-4 inline-block">
                          {audio.artist} • {audio.artist} • {audio.artist} • 
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-xs truncate">{audio.artist}</p>
                    )}
                  </div>
                </div>
                
                {isPlaying && (
                  <button 
                    onClick={(e) => handleSelect(audio, e)}
                    className="ml-2 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light active:scale-95 transition-all flex-shrink-0"
                  >
                    Use
                  </button>
                )}
                
                {isSelected && !isPlaying && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </div>
            );
          })}
          
          {!loading && audios.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No sounds found
            </div>
          )}
        </div>
      )}
    </ContextualPanel>
  );
};

export const CoverSelector = ({ videoFile, selectedFrame, onChange, onClose }) => {
  return (
    <ContextualPanel title="Cover" onClose={onClose}>
      <RealCoverSelector 
        videoFile={videoFile} 
        selectedFrame={selectedFrame} 
        onChange={onChange} 
      />
    </ContextualPanel>
  );
};
