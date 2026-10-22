import React, { useMemo, useCallback } from 'react';
import { Play, Layers, Heart, MessageCircle } from 'lucide-react';
import { determineContentType, getPostMediaUrl } from '../../utils/contentType';
import { normalizeEngagement } from '../../utils/normalizePost';
import { useRelativeTime } from '../../hooks/useRelativeTime';

const TextPostCard = ({ post, onPostClick }) => {
  const engagement = normalizeEngagement(post);
  const text = post.content?.text || post.content?.caption || post.caption || '';
  const time = useRelativeTime(post.created_at || post.createdAt);

  return (
    <button
      type="button"
      onClick={onPostClick}
      className="w-full text-left bg-white border border-[#E8E8EC] rounded-2xl p-4 sm:p-5 mb-3 hover:border-[#6366F1]/30 transition-colors active:scale-[0.99]"
    >
      <p className="text-[#111111] text-[15px] leading-relaxed line-clamp-6 whitespace-pre-wrap mb-3">
        {text || 'Text post'}
      </p>
      <div className="flex items-center justify-between text-[#666666] text-[13px]">
        <span>{time}</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Heart size={14} /> {engagement.respectCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={14} /> {engagement.commentCount}
          </span>
        </div>
      </div>
    </button>
  );
};

export const PostGrid = ({ posts, tab, onPostClick }) => {
  const { filteredPosts, originalIndexMap } = useMemo(() => {
    const filtered = [];
    const map = [];
    
    posts.forEach((post, originalIndex) => {
      const contentType = determineContentType(post);
      let shouldInclude = false;
      
      if (tab === 'reels') shouldInclude = contentType === 'video';
      else if (tab === 'text') shouldInclude = contentType === 'text';
      else if (tab === 'images') shouldInclude = contentType === 'image' || contentType === 'carousel';
      else if (tab === 'featured') shouldInclude = post.isFeatured || post.is_featured;
      else shouldInclude = true;
      
      if (shouldInclude) {
        filtered.push(post);
        map.push(originalIndex);
      }
    });
    
    return { filteredPosts: filtered, originalIndexMap: map };
  }, [posts, tab]);

  const handlePostClick = useCallback((filteredIndex) => {
    const originalIndex = originalIndexMap[filteredIndex];
    if (originalIndex !== undefined) {
      // Pass the original index to the parent
      onPostClick(originalIndex);
    }
  }, [originalIndexMap, onPostClick]);

  if (filteredPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#888888]">
        <p className="text-[15px] font-medium">No posts yet</p>
      </div>
    );
  }

  if (tab === 'text') {
    return (
      <div className="w-full px-3 sm:px-4 py-2">
        {filteredPosts.map((post, filteredIndex) => (
          <TextPostCard key={post.id} post={post} onPostClick={() => handlePostClick(filteredIndex)} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[1px] sm:gap-1 w-full bg-[#E8E8EC] sm:bg-transparent">
      {filteredPosts.map((post, filteredIndex) => {
        const contentType = determineContentType(post);
        const isVideo = contentType === 'video';
        const isCarousel = contentType === 'carousel';
        const engagement = normalizeEngagement(post);
        const mediaUrl = getPostMediaUrl(post);

        return (
          <div
            key={post.id}
            className="aspect-[3/4] sm:aspect-square relative group bg-[#F7F7F9] cursor-pointer overflow-hidden sm:rounded-md"
            onClick={() => handlePostClick(filteredIndex)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePostClick(filteredIndex); }}
            aria-label={`Open post ${post.id}`}
          >
            {isVideo ? (
              <>
                <img
                  src={post.content?.thumbnailUrl || post.thumbnailUrl || mediaUrl}
                  className="w-full h-full object-cover"
                  alt="Video thumbnail"
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23F7F7F9"/></svg>';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white">
                  <Play size={14} fill="#fff" />
                  {engagement.viewCount > 0 && (
                    <span className="text-[12px] font-semibold">{engagement.viewCount}</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <img
                  src={mediaUrl}
                  className="w-full h-full object-cover"
                  alt="Post"
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%23F7F7F9"/></svg>';
                  }}
                />
                {isCarousel && (
                  <div className="absolute top-2 right-2 text-white drop-shadow-md">
                    <Layers size={18} />
                  </div>
                )}
              </>
            )}

            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex items-center justify-center gap-4">
              {engagement.respectCount > 0 && (
                <div className="flex items-center gap-1.5 text-white font-bold">
                  <Heart size={20} fill="#fff" />
                  <span>{engagement.respectCount}</span>
                </div>
              )}
              {engagement.commentCount > 0 && (
                <div className="flex items-center gap-1.5 text-white font-bold">
                  <MessageCircle size={20} fill="#fff" />
                  <span>{engagement.commentCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PostGrid;
