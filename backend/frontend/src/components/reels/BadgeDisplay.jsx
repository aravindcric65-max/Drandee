import React, { useEffect, useState } from 'react';
import { calculateRank, getRankProgress, formatRespects } from '../../utils/badgeSystem';

export const BadgeDisplay = ({ user, onClose }) => {
  const [animProgress, setAnimProgress] = useState(0);
  const respects = user?.respects || user?.totalRespects || 0;
  const rank = calculateRank(respects);
  const progress = getRankProgress(respects, rank.nextLevel);

  useEffect(() => {
    const timer = setTimeout(() => setAnimProgress(progress), 300);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }} onClick={onClose}>
      <div
        style={{ width: '90%', maxWidth: 340, borderRadius: 20, padding: '28px 24px', textAlign: 'center', background: rank.gradient, backgroundSize: '200% 200%', animation: 'badgeGlow 4s ease infinite', border: '1px solid rgba(255,255,255,0.2)', boxShadow: `0 20px 60px ${rank.color}60` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: 1, marginBottom: 4, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {rank.title}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 24 }}>
          Level {rank.level} · {rank.rarity}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 24, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '16px 8px' }}>
          {[
            { val: formatRespects(respects), label: 'Respects' },
            { val: `Top ${rank.percentage}`, label: 'Ranking' },
            { val: rank.rarity, label: 'Rarity' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {rank.nextLevel && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
              <span>{formatRespects(respects)}</span>
              <span>{formatRespects(rank.nextLevel)}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${animProgress}%`, background: 'rgba(255,255,255,0.85)', borderRadius: 3, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
            </div>
          </>
        )}

        {/* Challenge */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '12px 0 20px', fontStyle: 'italic' }}>
          Next challenge: {rank.challenge}
        </p>

        {/* Description */}
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 20px', lineHeight: 1.5 }}>
          {rank.description}
        </p>

        {/* Close */}
        <button type="button" onClick={onClose} style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '10px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', backdropFilter: 'blur(4px)' }}>
          Close
        </button>
      </div>
    </div>
  );
};

export default BadgeDisplay;
