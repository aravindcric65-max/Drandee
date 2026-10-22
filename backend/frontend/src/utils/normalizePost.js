import { determineContentType } from './contentType';

export function normalizeEngagement(post) {
  const e = post.engagement || {};
  const stats = post.stats || {};
  return {
    respectCount: e.respectCount ?? post.totalRespects ?? post.respects ?? stats.respects ?? 0,
    commentCount: e.commentCount ?? post.comments ?? stats.comments ?? 0,
    shareCount: e.shareCount ?? post.shares ?? stats.shares ?? 0,
    saveCount: e.saveCount ?? post.saves ?? stats.saves ?? 0,
    viewCount: e.viewCount ?? post.views ?? stats.views ?? post.watchCount ?? 0,
    hasRespected: e.hasRespected ?? post.has_respected ?? post.hasRespected ?? post.userInteraction?.hasRespected ?? false,
    hasSaved: e.hasSaved ?? post.has_saved ?? post.hasSaved ?? post.userInteraction?.hasSaved ?? false,
  };
}

export function normalizePrivacy(post) {
  const p = post.privacy || {};
  return {
    hideRespectCount: p.hideRespectCount ?? post.hide_respect_count ?? false,
    hideShareCount: p.hideShareCount ?? post.hide_share_count ?? false,
    commentsEnabled: p.commentsEnabled ?? (post.comments_enabled !== false),
    reuseEnabled: p.reuseEnabled ?? (post.reuse_enabled !== false),
  };
}

export function normalizePost(post) {
  if (!post || !post.id) return null;

  const engagement = normalizeEngagement(post);
  const privacy = normalizePrivacy(post);
  const contentType = determineContentType(post);

  return {
    ...post,
    id: post.id,
    type: contentType,
    post_type: post.post_type || contentType,
    content_type: post.content_type || contentType,
    created_at: post.created_at || post.createdAt,
    creator: post.creator || {
      id: post.creatorId || post.user_id || post.creator_id,
      username: post.creatorName || post.username,
      displayName: post.creator?.displayName || post.creatorName || post.displayName,
      avatarUrl: post.creator?.avatarUrl || post.avatarUrl || post.profilePic,
      isVerified: post.creator?.isVerified || post.isVerified || post.is_verified,
    },
    content: {
      videoUrl: post.content?.videoUrl || post.videoUrl,
      imageUrl: post.content?.imageUrl || post.imageUrl,
      thumbnailUrl: post.content?.thumbnailUrl || post.thumbnailUrl,
      caption: post.content?.caption || post.caption,
      text: post.content?.text || post.text_content || post.text,
      media: post.content?.media || post.content?.images || post.images || post.media,
      images: post.content?.images || post.images,
      audio: post.content?.audio || post.audio,
    },
    engagement,
    privacy,
    totalRespects: engagement.respectCount,
    comments: engagement.commentCount,
    shares: engagement.shareCount,
    saves: engagement.saveCount,
    views: engagement.viewCount,
    has_respected: engagement.hasRespected,
    has_saved: engagement.hasSaved,
  };
}

export function mergeEngagementIntoPost(post, engagement = {}) {
  if (!post) return post;
  const current = normalizeEngagement(post);
  const merged = {
    respectCount: engagement.respectCount ?? current.respectCount,
    commentCount: engagement.commentCount ?? current.commentCount,
    shareCount: engagement.shareCount ?? current.shareCount,
    saveCount: engagement.saveCount ?? current.saveCount,
    viewCount: engagement.viewCount ?? current.viewCount,
    hasRespected: engagement.hasRespected ?? current.hasRespected,
    hasSaved: engagement.hasSaved ?? current.hasSaved,
  };

  return {
    ...post,
    engagement: merged,
    totalRespects: merged.respectCount,
    respects: merged.respectCount,
    comments: merged.commentCount,
    shares: merged.shareCount,
    saves: merged.saveCount,
    views: merged.viewCount,
    has_respected: merged.hasRespected,
    hasRespected: merged.hasRespected,
    has_saved: merged.hasSaved,
    hasSaved: merged.hasSaved,
    stats: {
      ...(post.stats || {}),
      respects: merged.respectCount,
      comments: merged.commentCount,
      shares: merged.shareCount,
      saves: merged.saveCount,
      views: merged.viewCount,
    },
    userInteraction: {
      ...(post.userInteraction || {}),
      hasRespected: merged.hasRespected,
      hasSaved: merged.hasSaved,
    },
  };
}
