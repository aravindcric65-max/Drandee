import { mergeEngagementIntoPost, normalizeEngagement } from './normalizePost';

export function buildEngagementFromDelta(post, action, delta) {
  const current = normalizeEngagement(post);
  const next = { ...current };

  if (action === 'respect') {
    next.respectCount = Math.max(0, current.respectCount + delta);
    next.hasRespected = delta > 0;
  } else if (action === 'comment') {
    next.commentCount = Math.max(0, current.commentCount + delta);
  } else if (action === 'share') {
    next.shareCount = Math.max(0, current.shareCount + delta);
  } else if (action === 'save') {
    next.saveCount = Math.max(0, current.saveCount + delta);
    next.hasSaved = delta > 0;
  }

  return next;
}

export function applyEngagementEventToPosts(posts, detail) {
  const { postId, engagement, action, delta } = detail || {};
  if (!postId) return posts;

  const idx = posts.findIndex((p) => String(p.id) === String(postId));
  if (idx === -1) return posts;

  const newPosts = [...posts];
  const post = newPosts[idx];

  if (engagement) {
    newPosts[idx] = mergeEngagementIntoPost(post, engagement);
  } else if (action && typeof delta === 'number') {
    newPosts[idx] = mergeEngagementIntoPost(post, buildEngagementFromDelta(post, action, delta));
  }

  return newPosts;
}

export function dispatchEngagementUpdated(postId, engagement, action, delta) {
  window.dispatchEvent(
    new CustomEvent('engagement_updated', {
      detail: { postId, engagement, action, delta },
    })
  );
}

export function dispatchPostDeleted(postId) {
  window.dispatchEvent(
    new CustomEvent('post_deleted', {
      detail: { postId },
    })
  );
}

export function dispatchNewPostPublished(post) {
  window.dispatchEvent(
    new CustomEvent('new_post_published', {
      detail: post,
    })
  );
}
