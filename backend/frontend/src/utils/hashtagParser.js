/**
 * Parse hashtags in text and convert them to clickable links
 * @param {string} text - Text containing hashtags
 * @param {function} onHashtagClick - Optional click handler
 * @returns {Array} - Array of text fragments and hashtag components
 */
export const parseHashtags = (text, onHashtagClick) => {
  if (!text) return [];
  
  const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = hashtagRegex.exec(text)) !== null) {
    // Add text before hashtag
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // Add hashtag
    parts.push({
      type: 'hashtag',
      content: match[0],
      tag: match[1]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }
  
  return parts;
};

/**
 * Extract hashtags from text as array
 * @param {string} text - Text containing hashtags
 * @returns {Array} - Array of hashtag strings (without #)
 */
export const extractHashtags = (text) => {
  if (!text) return [];
  
  const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
  const hashtags = [];
  let match;
  
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1]);
  }
  
  return hashtags;
};
