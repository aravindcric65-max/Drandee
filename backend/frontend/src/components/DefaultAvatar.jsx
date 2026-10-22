// src/components/DefaultAvatar.jsx
import React from 'react';

const DefaultAvatar = ({ size = 36, src = null, alt = "avatar", className = "", style = {}, onClick = null, creatorId = null, creatorName = "" }) => {
  const finalSrc = src || null;

  const handleClick = (e) => {
    if (onClick) onClick(e);
  };

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        backgroundColor: "#e0e0e0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: (creatorId || onClick) ? "pointer" : "default",
        flexShrink: 0,
        ...style,
      }}
      onClick={handleClick}
      title={creatorName || "User"}
    >
      {finalSrc ? (
        <img src={finalSrc} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "65%", height: "65%", color: "#9e9e9e" }}
        >
          <path 
            d="M12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2ZM5 7C5 3.13401 8.13401 0 12 0C15.866 0 19 3.13401 19 7C19 10.866 15.866 14 12 14C8.13401 14 5 10.866 5 7ZM12 16C7.58172 16 4 19.5817 4 24H2C2 18.4772 6.47715 14 12 14C17.5228 14 22 18.4772 22 24H20C20 19.5817 16.4183 16 12 16Z" 
            fill="currentColor"
          />
        </svg>
      )}
    </div>
  );
};

export default DefaultAvatar;