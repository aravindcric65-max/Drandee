import { useRef } from "react";

const VideoPlayer = ({ videoUrl }) => {
  const videoRef = useRef();

  const handleTimeUpdate = () => {
    const video = videoRef.current;

    if (!video || !video.duration) return;

    const percent =
      (video.currentTime / video.duration) * 100;

    // hidden watch completion tracking
    if (percent > 80) {
      console.log("Viewer watched 80%");
    }
  };

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className="reel-video"
      autoPlay
      muted
      loop
      playsInline
      onTimeUpdate={handleTimeUpdate}
    />
  );
};

export default VideoPlayer;