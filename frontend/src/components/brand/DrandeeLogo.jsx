import React from 'react';

const DrandeeLogo = ({ className = "w-8 h-8", style = {} }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      style={style} 
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <linearGradient id="drandeeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" /> {/* Cyan */}
          <stop offset="100%" stopColor="#8A2BE2" /> {/* Violet */}
        </linearGradient>
      </defs>
      
      {/* Thin Outer Echo */}
      <path 
        d="M 30 6 L 48 6 C 75 6 94 25 94 50 C 94 75 75 94 48 94 L 30 94" 
        stroke="#111" 
        strokeWidth="4" 
        strokeLinecap="round" 
      />

      {/* Thick Black D */}
      <path 
        d="M 32 12 L 50 12 C 72 12 86 28 86 50 C 86 72 72 88 50 88 L 32 88 C 18 88 10 78 10 64 L 10 36 C 10 22 18 12 32 12 Z M 36 34 L 46 34 C 56 34 62 40 62 50 C 62 60 56 66 46 66 L 36 66 C 32 66 30 64 30 60 L 30 40 C 30 36 32 34 36 34 Z" 
        fill="#111" 
        fillRule="evenodd" 
      />

      {/* Gradient Inner Curve */}
      <path 
        d="M 40 20 C 28 20 24 30 24 42 L 24 58 C 24 70 28 80 40 80" 
        stroke="url(#drandeeGrad)" 
        strokeWidth="8" 
        strokeLinecap="round" 
      />

      {/* Play Button */}
      <path d="M 42 38 L 58 50 L 42 62 Z" fill="#111" />
    </svg>
  );
};

export default DrandeeLogo;
