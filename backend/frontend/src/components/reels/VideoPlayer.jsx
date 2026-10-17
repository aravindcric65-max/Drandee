import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export const VideoPlayer = forwardRef(({ post, isActive, paused, speed = 2.0, onLoadedData }, ref) => {
  const videoRef = useRef(null);

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

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#090A0F' }}>
      {post?.videoUrl?.trim() ? (
        <video
          ref={videoRef}
          src={post.videoUrl}
          poster={post.thumbnail || post.imageUrl}
          loop muted playsInline
          preload="metadata"
          controls={false}
          onLoadedData={onLoadedData}
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
