import React, { useRef, useState, useCallback, useEffect } from 'react';

export const ProgressBar = ({ current, total, onSeek }) => {
  const barRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const width = total > 0 ? ((current + 1) / total) * 100 : 0;

  const seek = useCallback((clientX) => {
    if (!barRef.current || total <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    onSeek(Math.min(Math.floor(pct * total), total - 1));
  }, [total, onSeek]);

  const onDown = (e) => {
    setDragging(true);
    seek(e.clientX || e.touches?.[0]?.clientX);
  };

  const onMove = useCallback((e) => {
    if (!dragging) return;
    seek(e.clientX || e.touches?.[0]?.clientX);
  }, [dragging, seek]);

  const onUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, onMove, onUp]);

  if (total <= 1) return null;

  return (
    <div
      ref={barRef}
      onMouseDown={onDown}
      onTouchStart={onDown}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: dragging ? '5px' : '2px',
        background: 'rgba(255,255,255,0.06)',
        cursor: 'pointer', zIndex: 60,
        transition: 'height 0.15s ease',
      }}
    >
      <div style={{
        height: '100%', width: `${width}%`,
        background: 'linear-gradient(90deg, #9c27b0, #c51162)',
        borderRadius: '0 1px 1px 0',
        transition: dragging ? 'none' : 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
};

export default ProgressBar;
