// src/components/DefaultAvatar.jsx
import React, { useState, useEffect } from 'react';

// Generate a consistent hue (0-360) from a string
function stringToHue(str) {
  if (!str) return 270; // default purple
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

// Inline SVG silhouette — clean, consistent user icon
function SilhouetteIcon({ size }) {
  const s = Math.round(size * 0.55);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: s, height: s, color: 'rgba(255,255,255,0.65)' }}
      aria-hidden="true"
    >
      <path
        d="M12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2ZM5 7C5 3.13401 8.13401 0 12 0C15.866 0 19 3.13401 19 7C19 10.866 15.866 14 12 14C8.13401 14 5 10.866 5 7ZM12 16C7.58172 16 4 19.5817 4 24H2C2 18.4772 6.47715 14 12 14C17.5228 14 22 18.4772 22 24H20C20 19.5817 16.4183 16 12 16Z"
        fill="currentColor"
      />
    </svg>
  );
}

const DefaultAvatar = ({ size = 36, src = null, alt = "", className = "", style = {}, onClick = null, creatorId = null, creatorName = "" }) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state when src changes — allows recovery if a broken URL
  // is replaced with a valid one on the same mounted instance.
  useEffect(() => {
    setImgError(false);
  }, [src]);

  const showImage = src && !imgError;

  // Seed hue from the more stable creatorId, falling back to name
  const hueSeed = String(creatorId || '') || creatorName || '';
  const hue = stringToHue(hueSeed);
  const bgColor = `hsl(${hue}, 42%, 40%)`;

  const handleClick = (e) => {
    if (onClick) onClick(e);
  };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: (creatorId || onClick) ? "pointer" : "default",
        flexShrink: 0,
        ...style,
      }}
      onClick={handleClick}
      title={creatorName || "User"}
      aria-label={creatorName || "User avatar"}
    >
      {/* Fallback layer — always rendered (silhouette) */}
      <div style={{ zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SilhouetteIcon size={size} />
      </div>

      {/* Image layer — on top, hidden when no src or on error */}
      {showImage && (
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 1,
          }}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
};

export default DefaultAvatar;
