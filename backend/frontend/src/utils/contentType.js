/**
 * Canonical content type detection for posts.
 * Returns: "video" | "image" | "carousel" | "text"
 */

function hasCarouselMedia(post) {
  const images = post.content?.images || post.content?.media || post.images || post.media;
  if (Array.isArray(images) && images.length > 1) return true;
  if (post.isCarousel || post.is_carousel) return true;
  return false;
}

function hasVideoMedia(post) {
  const url = post.content?.videoUrl || post.videoUrl || post.content?.mediaUrl;
  if (!url) return false;
  return /\.(mp4|mov|webm|avi|mkv|flv|wmv|m4v)(\?|$)/i.test(String(url));
}

function hasImageMedia(post) {
  return Boolean(
    post.content?.imageUrl ||
    post.imageUrl ||
    post.thumbnailUrl ||
    post.content?.thumbnailUrl ||
    (Array.isArray(post.content?.images) && post.content.images.length > 0) ||
    (Array.isArray(post.images) && post.images.length > 0)
  );
}

function normalizeTypeValue(value) {
  if (!value) return null;
  const ct = String(value).toLowerCase();
  if (ct === 'video' || ct === 'reel') return 'video';
  if (ct === 'text' || ct === 'discussion') return 'text';
  if (ct === 'carousel') return 'carousel';
  if (ct === 'photo' || ct === 'image') return 'image';
  return null;
}

export function determineContentType(post) {
  if (!post) return 'image';

  // Priority 1: content_type from backend
  const fromContentType = normalizeTypeValue(post.content_type);
  if (fromContentType) return fromContentType;

  // Priority 2: type / post_type
  const fromType = normalizeTypeValue(post.type) || normalizeTypeValue(post.post_type);
  if (fromType) return fromType;

  // Priority 3: canonical content field detection
  if (hasCarouselMedia(post)) return 'carousel';
  if (hasVideoMedia(post)) return 'video';

  const textBody = post.content?.text || post.text_content || post.text;
  const caption = post.caption || post.content?.caption;
  if ((post.type === 'text' || post.post_type === 'text') && !hasImageMedia(post) && !hasVideoMedia(post)) {
    return 'text';
  }
  if (textBody && !hasImageMedia(post) && !hasVideoMedia(post) && !hasCarouselMedia(post)) {
    return 'text';
  }
  if (caption && !hasImageMedia(post) && !hasVideoMedia(post) && !hasCarouselMedia(post)) {
    return 'text';
  }

  // Priority 4: safe fallback
  return 'image';
}

export function isVideoPost(post) {
  return determineContentType(post) === 'video';
}

export function isTextPost(post) {
  return determineContentType(post) === 'text';
}

export function isImagePost(post) {
  return determineContentType(post) === 'image';
}

export function isCarouselPost(post) {
  return determineContentType(post) === 'carousel';
}

/** @deprecated use isImagePost */
export function isPhotoPost(post) {
  const t = determineContentType(post);
  return t === 'image' || t === 'carousel';
}

export function getContentTypeIcon(contentType) {
  const icons = {
    video: 'play',
    text: 'file-text',
    image: 'image',
    carousel: 'layers',
  };
  return icons[contentType] || 'image';
}

export function getCarouselImages(post) {
  const raw = post.content?.images || post.content?.media || post.images || post.media || [];
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((item) => (typeof item === 'string' ? item : item?.url || item?.imageUrl)).filter(Boolean);
  }
  const single = post.content?.imageUrl || post.imageUrl;
  return single ? [single] : [];
}

export function getPostMediaUrl(post) {
  const type = determineContentType(post);
  if (type === 'video') {
    return post.content?.videoUrl || post.videoUrl || post.thumbnailUrl || post.content?.thumbnailUrl;
  }
  if (type === 'carousel') {
    const images = getCarouselImages(post);
    return images[0] || post.thumbnailUrl;
  }
  return post.content?.imageUrl || post.imageUrl || post.thumbnailUrl || post.content?.thumbnailUrl;
}
