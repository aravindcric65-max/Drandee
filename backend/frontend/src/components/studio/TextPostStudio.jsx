import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Type } from 'lucide-react';
import PrivacyPanel from './PrivacyPanel';
import { parseApiResponse } from '../../utils/apiHelper';

const FONTS = [
  { name: 'System', value: 'system-ui, sans-serif' },
  { name: 'Serif', value: 'ui-serif, Georgia, serif' },
  { name: 'Mono', value: 'ui-monospace, monospace' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Comic', value: '"Comic Sans MS", cursive, sans-serif' },
  { name: 'Playfair', value: '"Playfair Display", serif' },
  { name: 'Bebas', value: '"Bebas Neue", sans-serif' }
];

const GRADIENTS = [
  'linear-gradient(135deg, #FF6B6B, #556270)',
  'linear-gradient(135deg, #4ECDC4, #556270)',
  'linear-gradient(135deg, #108dc7, #ef8e38)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #C06C84, #6C5B7B, #355C7D)',
  'linear-gradient(135deg, #1e3c72, #2a5298)',
  'linear-gradient(135deg, #FF0099, #493240)'
];

const TextPostStudio = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState('editor'); // 'editor', 'publish', 'uploading', 'success'
  const [text, setText] = useState('');
  const [font, setFont] = useState(FONTS[0]);
  const [background, setBackground] = useState(GRADIENTS[0]);
  const [showFonts, setShowFonts] = useState(false);
  
  const [settings, setSettings] = useState({
    caption: '',
    hashtags: [],
    privacy: 'public',
    allowComments: true,
    allowSharing: true,
    allowDuet: true
  });

  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [text, font]);

  const handlePublishClick = (finalSettings) => {
    setSettings(prev => ({ ...prev, ...finalSettings }));
    setCurrentStep('publish');
  };

  const handleConfirmPublish = async () => {
    try {
      // Send directly to post endpoint for text posts
      const response = await fetch('/api/upload/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: 'text',
          caption: text, // Use the typed text, not settings.caption which is empty
          hashtags: [...new Set((text.match(/#([a-zA-Z0-9_]+)/g) || []).map(t => t.replace('#', '').toLowerCase()))],
          visibility: settings.privacy || 'public'
        })
      });
      
      const result = await parseApiResponse(response, "Text Post Publishing");
      
      if (result.success && result.data) {
        // Dispatch global event for live feed update
        window.dispatchEvent(new CustomEvent('new_post_published', { detail: result.data }));
      } else {
        throw new Error(result.error?.message || 'Failed to create text post');
      }
      
      onClose(); // Close the studio and return to feed
    } catch (err) {
      console.error('Upload Error:', err);
      alert(err.message);
    }
  };

  if (currentStep === 'publish') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black text-white pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <PrivacyPanel 
          initialSettings={settings}
          onBack={() => setCurrentStep('editor')}
          onClose={onClose}
          onSave={(newSettings) => setSettings(prev => ({ ...prev, ...newSettings }))}
          onNext={handleConfirmPublish}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-white flex flex-col h-[100dvh] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <header className="flex items-center justify-between p-4 z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-95"
        >
          <X size={20} />
        </button>
        <button 
          onClick={() => handlePublishClick(settings)}
          disabled={!text.trim()}
          className="px-6 py-2 rounded-full bg-primary font-bold text-sm disabled:opacity-50 disabled:bg-white/10 active:scale-95"
        >
          Next
        </button>
      </header>

      {/* Editor Canvas */}
      <div 
        className="flex-1 relative flex items-center justify-center p-8 transition-colors duration-300"
        style={{ background }}
        onClick={() => setShowFonts(false)}
      >
        <label htmlFor="text-post-input" className="sr-only">Text Post Content</label>
        <textarea
          id="text-post-input"
          name="textPostContent"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start typing..."
          className="w-full bg-transparent border-none outline-none text-center resize-none text-white placeholder-white/50 leading-tight"
          style={{ 
            fontFamily: font.value,
            fontSize: Math.max(24, 64 - text.length / 5) + 'px',
            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}
          autoFocus
        />
      </div>

      {/* Toolbar */}
      <div className="bg-black pb-safe border-t border-white/10 relative z-50 pointer-events-auto">
        <AnimatePresence>
          {showFonts && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/10 p-4 overflow-hidden"
            >
              <p className="text-xs text-white/50 mb-3 uppercase tracking-wider font-semibold">Select Font</p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {FONTS.map(f => (
                  <button
                    key={f.name}
                    onClick={() => setFont(f)}
                    className={`shrink-0 px-5 py-3 rounded-xl border ${font.name === f.name ? 'border-primary bg-primary/20' : 'border-white/10 bg-white/5'} transition-all cursor-pointer hover:bg-white/10`}
                    style={{ fontFamily: f.value }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex p-4 gap-4 overflow-x-auto scrollbar-hide items-center relative z-50">
          <button 
            onClick={() => setShowFonts(!showFonts)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 font-semibold text-sm active:bg-white/20 transition-colors cursor-pointer hover:bg-white/20"
          >
            <Type size={18} />
            Fonts
          </button>
          
          <div className="w-px h-10 bg-white/10 shrink-0" />
          
          {GRADIENTS.map((grad, i) => (
            <button
              key={i}
              onClick={() => setBackground(grad)}
              className={`shrink-0 w-12 h-12 rounded-full border-2 ${background === grad ? 'border-white scale-110' : 'border-transparent'} shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all relative z-50`}
              style={{ background: grad }}
              aria-label={`Select gradient ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TextPostStudio;
