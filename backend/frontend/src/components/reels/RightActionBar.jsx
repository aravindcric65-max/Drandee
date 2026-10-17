import React, { useState } from 'react';
import { RespectIcon, CommentIcon, ShareIcon, BookmarkIcon, DotsIcon, MusicNoteIcon } from './ReelsIcons';

const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

const ActionBtn = ({ icon, count, active, activeColor, onPress, isRespect }) => {
  const [pop, setPop] = useState(false);
  const handle = () => {
    setPop(true);
    setTimeout(() => setPop(false), isRespect ? 380 : 220);
    onPress();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={handle}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))',
        transform: pop ? (isRespect ? 'scale(1.32) rotate(-6deg)' : 'scale(1.22)') : 'scale(1)',
        transition: pop ? 'transform 0.14s cubic-bezier(0.34,1.56,0.64,1)' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {icon}
      </div>
      {count !== undefined && (
        <span style={{ fontSize: 12, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)', color: active ? (activeColor || '#fff') : 'rgba(255,255,255,0.85)' }}>
          {count}
        </span>
      )}
    </div>
  );
};

export const RightActionBar = ({
  post, respected, saved, liveRespects, commentCount, shareCount, paused,
  onRespect, onComment, onShare, onSave, onMore, onAudioClick,
  onSpeedLongPress, onSpeedRelease,
}) => {
  if (!post) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 14px 0 8px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      {/* Rotating audio disc + symbol */}
      <div onClick={onAudioClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', marginBottom: 4 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
          background: 'linear-gradient(135deg, #9c27b0, #c51162)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid rgba(255,255,255,0.15)',
          animation: paused ? 'pulseGlow 2s ease-in-out infinite' : 'spinDisc 3s linear infinite, pulseGlow 2s ease-in-out infinite',
          boxShadow: '0 0 12px rgba(156,39,176,0.5)',
        }}>
          <MusicNoteIcon />
        </div>
        {/* + badge */}
        <div className="audio-plus-icon"
          onPointerDown={onSpeedLongPress}
          onPointerUp={onSpeedRelease}
          onPointerLeave={onSpeedRelease}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid #090A0F', marginTop: -10, zIndex: 2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            cursor: 'pointer'
          }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#090A0F', lineHeight: 1 }}>+</span>
        </div>
      </div>

      {/* Respect */}
      <ActionBtn
        icon={<RespectIcon active={respected} />}
        count={fmt(liveRespects)}
        active={respected}
        activeColor="#FF3B30"
        isRespect
        onPress={onRespect}
      />

      {/* Comment */}
      <ActionBtn
        icon={<CommentIcon />}
        count={fmt(commentCount)}
        onPress={onComment}
      />

      {/* Share */}
      <ActionBtn
        icon={<ShareIcon />}
        count={fmt(shareCount)}
        onPress={onShare}
      />

      {/* Save */}
      <ActionBtn
        icon={<BookmarkIcon active={saved} />}
        count={fmt(post.saves || 0)}
        active={saved}
        activeColor="#AFA9EC"
        onPress={onSave}
      />

      {/* More / Privacy */}
      <div
        onClick={onMore}
        style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', transition: 'background 0.2s' }}>
        <DotsIcon />
      </div>
    </div>
  );
};

export default RightActionBar;
