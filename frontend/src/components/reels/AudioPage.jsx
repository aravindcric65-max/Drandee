import React, { useState, useEffect } from 'react';
import { MusicNoteIcon } from './ReelsIcons';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const AudioPage = ({ audioName = 'Original Audio', audioCreator, audioId, post, onClose, onUseAudio, onPlayReel }) => {
  const [audioReels, setAudioReels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API call would go here. For now, empty array.
    setAudioReels([]);
    setLoading(false);
  }, [audioId, audioName]);

  const handleReelTap = (reel) => {
    onPlayReel && onPlayReel(reel);
    onClose();
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[200] bg-[#050505] text-white flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-white/10 bg-[#09090e]">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Audio</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="p-4 bg-[#09090e]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center shadow-[0_4px_24px_rgba(127,119,221,0.4)] animate-[spin_6s_linear_infinite]">
              <MusicNoteIcon />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{audioName}</h1>
              {audioCreator && (
                <p className="text-white/50 text-sm mt-1 truncate">by {audioCreator}</p>
              )}
              <span className="inline-block mt-2 px-3 py-1 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-semibold border border-[var(--primary)]/30">
                {loading ? '...' : `${audioReels.length} reels`}
              </span>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            {[
              { val: fmt((post?.watchCount || post?.views || 0) + audioReels.reduce((s, r) => s + (r.views || 0), 0)), label: 'Total Views' },
              { val: loading ? '...' : String(audioReels.length), label: 'Reels' },
              { val: fmt(audioReels.reduce((s, r) => s + (r.respects || 0), 0)), label: 'Respects' },
            ].map((s, i) => (
              <div key={s.label} className={`flex-1 text-center py-3 rounded-xl ${i === 1 ? 'bg-[var(--primary)]/10' : 'bg-white/5'}`}>
                <div className="text-lg font-bold">{s.val}</div>
                <div className="text-xs text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={onUseAudio}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_16px_rgba(127,119,221,0.4)]"
          >
            🎵 Use This Audio
          </button>
        </div>

        <div className="p-4">
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
            {loading ? 'Loading reels...' : audioReels.length > 0 ? `Reels using this audio` : 'No reels found'}
          </h3>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {audioReels.length > 0
                ? audioReels.map(reel => (
                  <div
                    key={reel.id}
                    onClick={() => handleReelTap(reel)}
                    className="aspect-[9/16] relative bg-[#1a1a2e] cursor-pointer group"
                  >
                    {reel.thumbnail
                      ? <img src={reel.thumbnail} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#2d0a4e]" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 opacity-80 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-1 text-[10px] font-semibold">
                        <span>👁</span> {fmt(reel.views)}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--primary)]">
                        <span>❤️</span> {fmt(reel.respects)}
                      </div>
                    </div>
                  </div>
                ))
                : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] bg-white/5 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                      <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white/40 ml-1" />
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AudioPage;
