import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseHashtags } from '../utils/hashtagParser';

const CaptionDisplay = ({ postId, caption, maxLength = 150, className = '' }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  
  if (!caption) return null;
  
  const shouldTruncate = caption.length > maxLength;
  const displayText = (expanded || !shouldTruncate) ? caption : caption.slice(0, maxLength) + '...';
  
  const parsedParts = parseHashtags(displayText);
  
  const handleHashtagClick = (tag) => {
    navigate(`/tag/${tag}`);
  };
  
  return (
    <div className={`caption-display ${className}`}>
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {parsedParts.map((part, index) => {
          if (part.type === 'hashtag') {
            return (
              <span
                key={index}
                onClick={() => handleHashtagClick(part.tag)}
                className="text-primary font-medium cursor-pointer hover:underline"
              >
                {part.content}
              </span>
            );
          }
          return <span key={index}>{part.content}</span>;
        })}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary text-sm font-medium mt-1 hover:underline"
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default CaptionDisplay;
