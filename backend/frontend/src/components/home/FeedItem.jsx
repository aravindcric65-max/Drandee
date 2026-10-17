import React, { useMemo, useCallback } from 'react';
import { VideoPost } from './VideoPost';
import { PhotoPost } from './PhotoPost';
import { CarouselPost } from './CarouselPost';
import { TextPost } from './TextPost';
import { DiscussionPost } from './DiscussionPost';
import { TrendingTopics } from './TrendingTopics';
import { RecommendedCreators } from './RecommendedCreators';
import { ContinueWatching } from './ContinueWatching';
import { LocalCreatorDiscovery } from './LocalCreatorDiscovery';

export const FeedItem = ({ post, isActive, index, mode, onRespect, onComment, onShare, onSave, onFollow, onMore, interactionProps: externalProps }) => {
  // Memoize interaction props to prevent unnecessary re-renders
  const interactionProps = useMemo(() => ({
    onRespect,
    onComment,
    onShare,
    onSave,
    onFollow,
    onMore,
    userInteraction: post.userInteraction || {},
    stats: post.stats || {},
    ...externalProps
  }), [onRespect, onComment, onShare, onSave, onFollow, onMore, post.userInteraction, post.stats, externalProps]);

  // Safe content checks
  const hasVideoUrl = useCallback(() => {
    return post.content?.videoUrl || post.videoUrl;
  }, [post.content, post.videoUrl]);

  const hasImageUrl = useCallback(() => {
    return post.content?.imageUrl || post.imageUrl || (post.content?.images && post.content.images.length > 0);
  }, [post.content, post.imageUrl]);

  const postType = post.type;

  // Render based on post type
  switch (postType) {
    // Standard Content Types
    case 'video':
      return (
        <VideoPost 
          post={post} 
          isActive={isActive} 
          index={index}
          interactionProps={interactionProps} 
        />
      );
    
    case 'photo':
      return (
        <PhotoPost 
          post={post} 
          index={index}
          interactionProps={interactionProps} 
        />
      );
    
    case 'carousel':
      return (
        <CarouselPost 
          post={post} 
          index={index}
          interactionProps={interactionProps} 
        />
      );
    
    case 'text':
      return (
        <TextPost 
          post={post} 
          index={index}
          interactionProps={interactionProps} 
        />
      );
    
    case 'discussion':
      return (
        <DiscussionPost 
          post={post} 
          index={index}
          interactionProps={interactionProps} 
        />
      );
    
    // Algorithmic Modules
    case 'module_local_creators':
      return <LocalCreatorDiscovery mode={mode} />;
    
    case 'module_trending':
      return <TrendingTopics mode={mode} />;
    
    case 'module_recommended_creators':
      return <RecommendedCreators mode={mode} />;
    
    case 'module_continue_watching':
      return <ContinueWatching />;
    
    // Fallback for malformed or unknown data
    default:
      // Try to infer type from content
      if (hasVideoUrl()) {
        return (
          <VideoPost 
            post={post} 
            isActive={isActive} 
            index={index}
            interactionProps={interactionProps} 
          />
        );
      }
      
      if (hasImageUrl()) {
        return (
          <PhotoPost 
            post={post} 
            index={index}
            interactionProps={interactionProps} 
          />
        );
      }
      
      // Safely ignore unknown types with a warning
      console.warn('Unknown post type:', postType, 'Post ID:', post.id);
      return null;
  }
};

export default FeedItem;