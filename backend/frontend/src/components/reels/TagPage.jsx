import React, { useState, useEffect } from 'react';
import { ArrowLeft, Hash } from 'lucide-react';
import { motion } from 'framer-motion';

const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const TagPage = ({ tagName, onClose, onPlayReel }) => {
  const [tagReels, setTagReels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tagName) { setLoading(false); return; }
    setTimeout(() => {
      // API call would go here. For now, empty array.
      setTagReels([]);
      setLoading(false);
    }, 400);
  }, [tagName]);

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[200] bg-[#050505] text-white flex flex-col"
    >
      <div className="flex items-center gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-white/10 bg-[#09090e]">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-bold">Tag</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="p-4 bg-[#09090e]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center shadow-[0_4px_24px_rgba(127,119,221,0.4)]">
              <Hash size={40} className="text-white opacity-80" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">#{tagName}</h1>
              <span className="inline-block mt-2 px-3 py-1 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-semibold border border-[var(--primary)]/30">
                1000+ uploads
              </span>
            </div>
          </div>

          <button className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_16px_rgba(127,119,221,0.4)]">
            Use This Tag
          </button>
        </div>

        <div className="p-4">
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
            Reels with this tag
          </h3>

          <div className="grid grid-cols-3 gap-1">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[9/16] bg-white/5 animate-pulse" />
              ))
            ) : (
              tagReels.map(reel => (
                <div
                  key={reel.id}
                  onClick={() => { onPlayReel && onPlayReel(reel); onClose(); }}
                  className="aspect-[9/16] relative bg-[#1a1a2e] cursor-pointer group"
                >
                  {reel.thumbnail ? (
                    <img src={reel.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#2d0a4e]" />
                  )}
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
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TagPage;
