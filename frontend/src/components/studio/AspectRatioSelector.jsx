import React from 'react';
import { motion } from 'framer-motion';

const AspectRatioSelector = ({ selected, onChange }) => {
  const ratios = [
    { value: '9:16', label: '9:16', desc: 'Reels/TikTok' },
    { value: '1:1', label: '1:1', desc: 'Square' },
    { value: '16:9', label: '16:9', desc: 'Landscape' },
    { value: '4:5', label: '4:5', desc: 'Portrait' },
  ];

  return (
    <div className="mt-4">
      <h3 className="text-white font-semibold mb-3">Aspect Ratio</h3>
      <div className="grid grid-cols-4 gap-2">
        {ratios.map((ratio) => (
          <motion.button
            key={ratio.value}
            onClick={() => onChange(ratio.value)}
            className={`p-3 rounded-xl border transition-colors
              ${selected === ratio.value
                ? 'border-primary bg-primary/20'
                : 'border-bgBorder bg-bgCard hover:border-primary/50'}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="text-white font-bold text-sm">{ratio.label}</div>
            <div className="text-textSecondary text-xs mt-1">{ratio.desc}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default AspectRatioSelector;