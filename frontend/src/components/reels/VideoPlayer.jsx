import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

export const VideoPlayer = forwardRef(({ post, isActive, paused, speed = 2.0, onLoadedData }, ref) => {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);

  useImperativeHandle(ref, () => videoRef.current);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive, paused]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = speed;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  useEffect(() => {
    setVideoError(false);
  }, [post?.id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting && !v.paused) v.pause(); },
      { threshold: 0.5 }
    );
    observer.observe(v);
    return () => observer.disconnect();
  }, []);

  const canonicalVideoUrl = post?.videoUrl || post?.content?.videoUrl;
  const canonicalThumbnail = post?.thumbnailUrl || post?.content?.thumbnailUrl || post?.thumbnail || post?.imageUrl || post?.content?.imageUrl;

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#090A0F' }}>
      {canonicalVideoUrl?.trim() ? (
        !videoError ? (
          <video
            ref={videoRef}
            src={canonicalVideoUrl}
            poster={canonicalThumbnail}
            loop muted playsInline
            preload="metadata"
            controls={false}
            onLoadedData={onLoadedData}
            onError={() => setVideoError(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a16', gap: 8 }}>
            {canonicalThumbnail ? (
              <img src={canonicalThumbnail} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, position: 'absolute', inset: 0 }} />
            ) : null}
            <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', padding: '0 24px' }}>
              Video unavailable
            </div>
          </div>
        )
      ) : post?.contentType === 'text' || post?.type === 'text' ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px', background: 'linear-gradient(to bottom right, #2a2a3a, #1a1a24)' }}>
           <p style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'center', fontWeight: '500', lineHeight: '1.5', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{post.caption || post.content?.text || post.content?.caption || ''}</p>
        </div>
      ) : canonicalThumbnail ? (
        <img
          src={canonicalThumbnail}
          alt="Reel content"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a16' }} />
      )}
      {/* Gradient vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)',
      }} />
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
