import React from 'react';

const DrandeeWordmark = ({ className = "text-2xl", showGradient = false }) => {
  // Using system font stack that looks premium and clean
  const baseClasses = `font-sans font-extrabold tracking-tight select-none ${className}`;
  const colorClasses = showGradient 
    ? "text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2]" 
    : "text-[#111111]";

  return (
    <span className={`${baseClasses} ${colorClasses}`} style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      Drandee
    </span>
  );
};

export default DrandeeWordmark;
