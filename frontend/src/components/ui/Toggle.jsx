import React from 'react';
import { motion } from 'framer-motion';

const Toggle = ({ enabled, onChange, label, description, disabled = false }) => {
  return (
    <div className="flex items-center justify-between">
      {label && (
        <div className="flex-1">
          <div className="text-white font-medium">{label}</div>
          {description && (
            <div className="text-gray-400 text-sm mt-0.5">{description}</div>
          )}
        </div>
      )}
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative w-12 h-6 rounded-full transition-all ${
          enabled ? 'bg-primary' : 'bg-white/10'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <motion.div
          initial={false}
          animate={{
            x: enabled ? 24 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-lg"
        />
      </button>
    </div>
  );
};

export default Toggle;