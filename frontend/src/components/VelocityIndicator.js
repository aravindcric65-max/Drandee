import React, { useState } from 'react';
import { useUser } from '../context/UserContext';

const VelocityIndicator = () => {
  const { velocity } = useUser();
  const [showTooltip, setShowTooltip] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!velocity || !visible) return null;

  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case 'very_high': return '#FF4757';
      case 'high': return '#FF6B81';
      case 'medium': return '#FFA502';
      case 'low': return '#2ED573';
      default: return '#747D8C';
    }
  };

  const getIntensityLabel = (intensity) => {
    switch (intensity) {
      case 'very_high': return '🔥 Very High';
      case 'high': return '⚡ High';
      case 'medium': return '📊 Medium';
      case 'low': return '😴 Low';
      default: return 'Unknown';
    }
  };

  const getTip = () => {
    if (velocity.isHighlyEngaged) {
      return "You're on fire! 🔥 Your engagement is very high.";
    }
    if (velocity.isAtRiskChurn) {
      return "Taking a break? 😴 Your engagement is low.";
    }
    return "Normal engagement level.";
  };

  return (
    <div
      className="velocity-indicator"
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className="velocity-dot"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getIntensityColor(velocity.intensity),
          animation: 'pulse 1s infinite',
        }}
      />
      <span>{getIntensityLabel(velocity.intensity)}</span>
      <span style={{ opacity: 0.7 }}>
        ({velocity.velocity.toFixed(1)})
      </span>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '0 4px',
          opacity: 0.5,
        }}
      >
        ✕
      </button>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            color: '#fff',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '11px',
            maxWidth: '200px',
            zIndex: 10000,
          }}
        >
          {getTip()}
          <br /><br />
          <strong>Stats:</strong><br />
          - Velocity: {velocity.velocity.toFixed(2)}<br />
          - Watch: {velocity.watchVelocity.toFixed(2)}/min<br />
          - Interactions: {velocity.interactionVelocity.toFixed(2)}/min
        </div>
      )}
    </div>
  );
};

export default VelocityIndicator;