import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Users, Lock, ChevronLeft, Image as ImageIcon, Check } from 'lucide-react';

const PrivacyPanel = ({ initialSettings = {}, onBack, onClose, onSave, onNext }) => {
  const [caption, setCaption] = useState(initialSettings.caption || '');
  const [privacy, setPrivacy] = useState(initialSettings.privacy || 'public');
  const [allowComments, setAllowComments] = useState(initialSettings.allowComments ?? true);
  const [allowDuet, setAllowDuet] = useState(initialSettings.allowDuet ?? true);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const handleSaveDraft = () => {
    if (window.confirm("Do you want to save this to drafts and keep editing later?")) {
      const extractedTags = (caption.match(/#[\p{L}\p{N}_]+/gu) || [])
        .map(t => t.slice(1).toLowerCase());
      onSave({ caption, privacy, allowComments, allowDuet, isDraft: true, hashtags: [...new Set(extractedTags)] });
      if (onClose) onClose();
      else onBack();
    }
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onSave({ ...initialSettings, caption, thumbnail_url: url });
      // We don't save immediately, just update local state or tell parent
    }
  };

  const handlePost = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const extractedTags = (caption.match(/#[\p{L}\p{N}_]+/gu) || [])
        .map(t => t.slice(1).toLowerCase());
      const uniqueTags = [...new Set(extractedTags)];
      const finalSettings = { caption, privacy, allowComments, allowDuet, isDraft: false, hashtags: uniqueTags };
      onSave(finalSettings);               // keep saving to parent state for other consumers
      await onNext(finalSettings);         // pass finalSettings directly so caller doesn't need flushed state
    } finally {
      setIsPublishing(false);
    }
  };

  const Toggle = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-all ${
        enabled ? 'bg-primary' : 'bg-white/10'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
          enabled ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-screen bg-[#0a0a0f] text-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe border-b border-white/5">
        <button onClick={onBack} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-lg">Post</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto pb-[100px]">
        
        {/* Caption & Cover Area */}
        <div className="p-4 flex gap-4 border-b border-white/5">
          <label htmlFor="caption-input" className="sr-only">Caption</label>
          <textarea
            id="caption-input"
            name="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe your post, add hashtags..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none outline-none h-32"
          />
          <label htmlFor="cover-upload" className="relative w-24 h-32 bg-black rounded-xl overflow-hidden border border-white/10 group cursor-pointer block">
            {initialSettings.thumbnail_url ? (
              <img src={initialSettings.thumbnail_url} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-white/5 flex flex-col items-center justify-center gap-1">
                <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">Select Cover</span>
              </div>
            )}
            <input id="cover-upload" name="coverUpload" type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </label>
        </div>

        {/* Privacy Setting */}
        <div className="p-4 border-b border-white/5">
          <h3 className="font-semibold mb-4 text-gray-300">Who can watch this video</h3>
          <div className="flex bg-white/5 rounded-xl p-1">
            {[
              { id: 'public', label: 'Public', icon: Globe },
              { id: 'friends', label: 'Friends', icon: Users },
              { id: 'private', label: 'Private', icon: Lock }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setPrivacy(opt.id)}
                className={`flex-1 py-2 flex flex-col items-center gap-1 rounded-lg transition-all ${
                  privacy === opt.id ? 'bg-white/10 shadow-lg' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <opt.icon className="w-4 h-4" />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* More Settings */}
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-white">Allow comments</h4>
              <p className="text-xs text-gray-400">People can comment on this video</p>
            </div>
            <Toggle enabled={allowComments} onChange={setAllowComments} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-white">Allow duet & stitch</h4>
              <p className="text-xs text-gray-400">Other users can create videos with yours</p>
            </div>
            <Toggle enabled={allowDuet} onChange={setAllowDuet} />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-black via-black/90 to-transparent flex gap-3">
        <button 
          onClick={handleSaveDraft}
          className="flex-1 py-4 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-white transition-colors"
        >
          Drafts
        </button>
        <button 
          onClick={handlePost}
          disabled={isPublishing}
          className={`flex-[2] py-4 rounded-xl bg-gradient-to-r from-primary to-secondary font-bold text-white transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-primary/30 ${isPublishing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
        >
          {isPublishing ? (
            'Publishing...'
          ) : (
            <>
              <Check className="w-5 h-5" />
              Post Video
            </>
          )}
        </button>
      </div>

    </motion.div>
  );
};

export default PrivacyPanel;