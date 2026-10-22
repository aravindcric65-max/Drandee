/**
 * Normalizes media URLs for consistent cross-device and production delivery.
 *
 * Rules:
 * 1. If null, undefined, empty, or not a string, returns null.
 * 2. If it contains a leading http(s)://(localhost|127.0.0.1)(:port)?/uploads/...:
 *    Strips the localhost origin, converting into a relative path /uploads/...
 * 3. If it is a relative path starting with /uploads/ (or uploads/):
 *    - If PUBLIC_MEDIA_BASE_URL is set (e.g. CDN or production origin), prepends it.
 *    - Otherwise, returns the clean relative path /uploads/...
 * 4. If it is a full URL of another host (ImageKit, Cloudinary, S3, Firebase, external https://...):
 *    Leaves it untouched.
 */

function normalizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Strip leading http(s)://(localhost|127.0.0.1)(:port)? from /uploads paths
  let path = trimmed.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?=\/uploads\/)/i, '');

  // If path starts as "uploads/..." without leading slash, add it
  if (/^uploads\//i.test(path)) {
    path = `/${path}`;
  }

  // If it's a relative /uploads path, optionally prepend PUBLIC_MEDIA_BASE_URL
  if (/^\/uploads\//i.test(path)) {
    const baseUrl = (process.env.PUBLIC_MEDIA_BASE_URL || '').trim().replace(/\/+$/, '');
    return baseUrl ? `${baseUrl}${path}` : path;
  }

  return path;
}

module.exports = {
  normalizeMediaUrl,
};
