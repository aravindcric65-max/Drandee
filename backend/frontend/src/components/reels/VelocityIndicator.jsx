import React, { useState } from 'react';
import { useUser } from '../../context/UserContext';

const COLORS = {
  very_high: '#FF4757',
  high: '#FF6B81',
  medium: '#FFA502',
  low: '#2ED573'
};

export const VelocityIndicator = () => {
  const { velocity } = useUser();
  const [showTooltip, setShowTooltip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!velocity || dismissed) return null;

  const color = COLORS[velocity.intensity] || COLORS.low;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        padding: '6px 12px',
        borderRadius: 20,
        border: `1px solid ${color}`,
        cursor: 'pointer'
      }}
      onClick={() => setShowTooltip(!showTooltip)}
    >
      <div 
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`
        }}
      />
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
        {velocity.intensity.replace('_', ' ')}
      </span>

      {showTooltip && (
        <div style={{
          position: 'absolute',
          top: 40,
          left: 0,
          background: 'rgba(20,20,25,0.95)',
          padding: 12,
          borderRadius: 12,
          minWidth: 200,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          cursor: 'default'
        }}
        onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Velocity Stats</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Score: {velocity.score?.toFixed(2)}</span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Watch Vel: {velocity.watchVelocity?.toFixed(2)}</span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Interaction Vel: {velocity.interactionVelocity?.toFixed(2)}</span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Skip Rate: {(velocity.skipRate * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};
