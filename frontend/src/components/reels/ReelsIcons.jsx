import React from 'react';

const svgI = (path, w = 24, stroke = 'rgba(255,255,255,0.88)') => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
    <path d={path} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export { svgI };

export const EyeIcon = ({ w = 14, stroke = 'currentColor' }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
    <path d="M21.257 10.962c.47.62.47 1.457 0 2.076C19.725 15.075 16.096 18 12 18s-7.725-2.925-9.257-4.962a1.65 1.65 0 010-2.076C4.275 8.925 7.904 6 12 6s7.725 2.925 9.257 4.962z" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" />
    <path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const CommentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const ShareIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.4" />
    <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" stroke="currentColor" strokeWidth="1.4" />
    <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

export const BookmarkIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" fill={active ? 'currentColor' : 'none'} strokeWidth={active ? "0" : "1.4"} strokeLinecap="round" />
  </svg>
);

export const BookmarkSolidIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#7F77DD">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

export const BookmarkSmIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="#AFA9EC">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

export const DotsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="5" r="1.5" fill="rgba(255,255,255,0.75)" />
    <circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,0.75)" />
    <circle cx="12" cy="19" r="1.5" fill="rgba(255,255,255,0.75)" />
  </svg>
);

export const PauseIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
    <rect x="6" y="4" width="3.5" height="16" rx="1" fill="rgba(255,255,255,0.85)" />
    <rect x="14.5" y="4" width="3.5" height="16" rx="1" fill="rgba(255,255,255,0.85)" />
  </svg>
);

export const CheckCircleIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="rgba(29,158,117,0.18)" />
    <path d="M7 12l4 4 6-6" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const EmojiIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={active ? '#7F77DD' : 'rgba(255,255,255,0.55)'} strokeWidth="1.5" />
    <path d="M8 13s1.5 2 4 2 4-2 4-2" stroke={active ? '#7F77DD' : 'rgba(255,255,255,0.55)'} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="9" cy="9" r="1" fill={active ? '#7F77DD' : 'rgba(255,255,255,0.55)'} />
    <circle cx="15" cy="9" r="1" fill={active ? '#7F77DD' : 'rgba(255,255,255,0.55)'} />
  </svg>
);

export const RespectIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" strokeWidth={active ? '0' : '1.4'} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DoubleTapIcon = ({ color }) => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill={color}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

export const SendIcon = () => svgI('M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2', 16, '#fff');
export const LinkIcon = () => svgI('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71', 14, 'rgba(255,255,255,0.35)');
export const LoopIcon = () => svgI('M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3', 16, '#7F77DD');
export const ChevSmIcon = () => svgI('M9 18L15 12L9 6', 16, 'rgba(255,255,255,0.35)');
export const PlaySmIcon = () => svgI('M6 4L20 12L6 20V4Z', 20, 'rgba(255,255,255,0.2)');
export const SlashIcon = () => svgI('M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636', 20, 'rgba(255,255,255,0.6)');
export const MuteIcon = () => svgI('M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6', 20, 'rgba(255,255,255,0.6)');
export const FlagIcon = () => svgI('M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7', 20, '#e05555');
export const DownloadIcon = () => svgI('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', 20, 'rgba(255,255,255,0.8)');
export const ShieldIcon = () => svgI('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 20, 'rgba(255,255,255,0.8)');
// Nav icons — 24px, 1.75px stroke, outline (inactive) and filled (active) variants
const navStroke = 'rgba(255,255,255,0.55)';
const navStrokeActive = '#7F77DD';

export const HomeNavIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10" stroke={active ? navStrokeActive : navStroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill={active ? navStrokeActive : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
);

export const ReelNavIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="6" width="14" height="12" rx="2" stroke={active ? navStrokeActive : navStroke} strokeWidth="1.75" fill={active ? navStrokeActive : 'none'} fillOpacity={active ? 0.15 : 0} />
    <path d="M15 10l6-3v10l-6-3z" stroke={active ? navStrokeActive : navStroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill={active ? navStrokeActive : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
);

export const SpotlightNavIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={active ? navStrokeActive : navStroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill={active ? navStrokeActive : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
);

export const UserNavIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={active ? navStrokeActive : navStroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill={active ? navStrokeActive : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
);

export const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const WAIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.55 1.35 5L2 22l5.15-1.3C8.55 21.52 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" stroke="#25D366" strokeWidth="1.6" />
  </svg>
);

export const TGIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M21.5 2L1.5 9.7l6.6 2.5 10.2-6.4-7.9 7.3V20l3.8-3.7 4.9 3.7z" stroke="#0088cc" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const TWIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M4 4l16 16M20 4L4 20" stroke="#1DA1F2" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const MoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="12" r="1.5" fill="#7F77DD" />
    <circle cx="12" cy="12" r="1.5" fill="#7F77DD" />
    <circle cx="19" cy="12" r="1.5" fill="#7F77DD" />
  </svg>
);

export const MusicNoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M9 18V5l12-2v13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" stroke="#fff" strokeWidth="1.6" />
    <circle cx="18" cy="16" r="3" stroke="#fff" strokeWidth="1.6" />
  </svg>
);
