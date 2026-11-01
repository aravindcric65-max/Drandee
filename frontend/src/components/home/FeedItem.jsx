import React, { useMemo } from 'react';
import { VideoPost } from './VideoPost';
import { PhotoPost } from './PhotoPost';
import { CarouselPost } from './CarouselPost';
import { TextPost } from './TextPost';
import { DiscussionPost } from './DiscussionPost';
import { TrendingTopics } from './TrendingTopics';
import { RecommendedCreators } from './RecommendedCreators';
import { ContinueWatching } from './ContinueWatching';
import { LocalCreatorDiscovery } from './LocalCreatorDiscovery';
import { determineContentType } from '../../utils/contentType';

export const FeedItem = ({ post, isActive, index, mode, onRespect, onComment, onShare, onSave, onFollow, onMore, interactionProps: externalProps }) => {
  const interactionProps = useMemo(() => ({
    onRespect,
    onComment,
    onShare,
    onSave,
    onFollow,
    onMore,
    userInteraction: {
      ...(post.userInteraction || {}),
      // Normalize active state from API field variants
      hasRespected: post.userInteraction?.hasRespected || post.hasRespected || post.has_respected || false,
      hasSaved: post.userInteraction?.hasSaved || post.hasSaved || post.has_saved || false,
    },
    stats: {
      ...(post.stats || {}),
      // Ensure all count fields are present with correct names
      respects: post.stats?.respects ?? post.totalRespects ?? 0,
      comments: post.stats?.comments ?? post.comments ?? 0,
      shares: post.stats?.shares ?? post.shares ?? 0,
      saves: post.stats?.saves ?? post.saves ?? 0,
      views: post.stats?.views ?? post.watchCount ?? 0,
    },
    ...externalProps
  }), [onRespect, onComment, onShare, onSave, onFollow, onMore, post.userInteraction, post.hasRespected, post.has_respected, post.hasSaved, post.has_saved, post.stats, post.totalRespects, post.comments, post.shares, post.saves, post.watchCount, externalProps]);

  const postType = post.type;

  // Algorithmic modules — preserve existing type field
  if (postType === 'module_local_creators') return <LocalCreatorDiscovery mode={mode} />;
  if (postType === 'module_trending') return <TrendingTopics mode={mode} />;
  if (postType === 'module_recommended_creators') return <RecommendedCreators mode={mode} />;
  if (postType === 'module_continue_watching') return <ContinueWatching />;
  if (postType === 'discussion') {
    return <DiscussionPost post={post} index={index} interactionProps={interactionProps} />;
  }

  const contentType = determineContentType(post);

  switch (contentType) {
    case 'video':
      return <VideoPost post={post} isActive={isActive} index={index} interactionProps={interactionProps} mode={mode} />;
    case 'carousel':
      return <CarouselPost post={post} isActive={isActive} index={index} interactionProps={interactionProps} mode={mode} />;
    case 'text':
      return <TextPost post={post} isActive={isActive} index={index} interactionProps={interactionProps} mode={mode} />;
    case 'image':
    default:
      return <PhotoPost post={post} isActive={isActive} index={index} interactionProps={interactionProps} mode={mode} />;
  }
};

export default FeedItem;