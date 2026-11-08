/**
 * routes/sharePreview.js
 * Public share-preview route: GET /v/:id
 *
 * Serves crawler-friendly HTML with Open Graph + Twitter Card metadata
 * for social media link previews. Redirects real browsers to the
 * in-app deep link /reels?postId=<id>.
 *
 * No authentication required (crawlers cannot authenticate).
 * Visibility rules: only public, non-deleted, approved posts from
 * non-protected, non-banned accounts are previewable.
 */

const express = require('express');
const { normalizeMediaUrl } = require('../utils/mediaUrl');

const router = express.Router();

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://drandee.app';

// ── HTML escaping for attribute and text contexts ──────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/[\r\n\t]/g, ' '); // strip newlines/control chars
}

// ── Truncate on word boundary at ~150 chars ─────────────────────────
function truncateCaption(text, maxLen = 150) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.substring(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) return slice.substring(0, lastSpace) + '…';
  return slice + '…';
}

// ── Determine content type label for fallback description ───────────
function contentTypeDescription(row) {
  const ct = row.content_type || row.type;
  if (ct === 'video' || ct === 'reel') return 'Watch this reel on Drandee';
  if (ct === 'text' || ct === 'discussion') return 'Read this post on Drandee';
  if (ct === 'carousel') return 'See this photo collection on Drandee';
  return 'See this photo on Drandee';
}

// ── Pick the best thumbnail URL ─────────────────────────────────────
function pickThumbnail(row) {
  // Priority: thumbnail_url → image_url → first carousel image
  let url = row.thumbnail_url || row.image_url;
  if (!url && row.content?.images) {
    const first = Array.isArray(row.content.images) ? row.content.images[0] : null;
    url = first?.url || first;
  }
  return url ? normalizeMediaUrl(url) : null;
}

// ── Build the full HTML document ────────────────────────────────────
function buildPreviewHTML({ title, description, imageUrl, ogUrl, ogType, twitterCard, redirectUrl, videoUrl }) {
  const eTitle = escapeHtml(title);
  const eDesc = escapeHtml(description);
  const eImage = escapeHtml(imageUrl || '');
  const eUrl = escapeHtml(ogUrl);
  const eRedirect = escapeHtml(redirectUrl);
  const eVideo = videoUrl ? escapeHtml(videoUrl) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${eTitle}</title>
  <meta name="description" content="${eDesc}">
  <link rel="canonical" href="${eUrl}">
  <meta property="og:title" content="${eTitle}">
  <meta property="og:description" content="${eDesc}">
  <meta property="og:image" content="${eImage}">
  <meta property="og:url" content="${eUrl}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:site_name" content="Drandee">
  ${eVideo ? `<meta property="og:video" content="${eVideo}">` : ''}
  <meta name="twitter:card" content="${escapeHtml(twitterCard)}">
  <meta name="twitter:title" content="${eTitle}">
  <meta name="twitter:description" content="${eDesc}">
  <meta name="twitter:image" content="${eImage}">
  <meta http-equiv="refresh" content="0; url=${eRedirect}">
</head>
<body>
  <script>location.replace("${eRedirect}")</script>
  <noscript><a href="${eRedirect}">Open in Drandee</a></noscript>
</body>
</html>`;
}

// ── Generic fallback page ────────────────────────────────────────────
function genericPreview(statusCode) {
  const title = 'Drandee';
  const desc = 'Share your moment on Drandee — a social platform for creators.';
  const image = `${BASE_URL}/logo192.png`;
  const url = BASE_URL;
  const html = buildPreviewHTML({
    title,
    description: desc,
    imageUrl: image,
    ogUrl: url,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    redirectUrl: `${BASE_URL}/feed`,
    videoUrl: null,
  });
  return { html, statusCode };
}

// ── Route handler ───────────────────────────────────────────────────
module.exports = (pool) => {
  router.get('/:id', async (req, res, next) => {
    try {
      const rawId = req.params.id;
      const postId = parseInt(rawId, 10);

      // Strict ID validation — reject non-integers
      if (!Number.isInteger(postId) || postId <= 0) {
        const { html, statusCode } = genericPreview(404);
        res.status(404);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(html);
      }

      // Query the post with visibility + creator privacy rules
      // Only public, non-deleted, approved posts from non-protected, non-banned accounts
      const result = await pool.query(
        `SELECT
           p.id, p.caption, p.image_url, p.video_url, p.thumbnail_url,
           p.content_type, p.type, p.is_deleted, p.is_private,
           p.moderation_status,
           u.name AS creator_name, u.username AS creator_username,
           u.is_protected, u.account_status
         FROM posts p
         LEFT JOIN users u ON COALESCE(p.user_id, p.creator_id) = u.id
         WHERE p.id = $1
         LIMIT 1`,
        [postId]
      );

      if (result.rows.length === 0) {
        // Post does not exist — generic 404
        const { html, statusCode } = genericPreview(404);
        res.status(404);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(html);
      }

      const row = result.rows[0];

      // Visibility checks — must not leak private content
      const isDeleted = row.is_deleted === true;
      const isPrivate = row.is_private === true;
      const isUnapproved = row.moderation_status && row.moderation_status !== 'approved';
      const isProtectedCreator = row.is_protected === true;
      const isBannedCreator = row.account_status === 'BANNED';

      if (isDeleted || isPrivate || isUnapproved || isProtectedCreator || isBannedCreator) {
        // Generic 200 for private content — never reveal existence
        const { html } = genericPreview(200);
        res.status(200);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(html);
      }

      // Post is publicly previewable — build rich metadata
      const displayName = row.creator_name || row.creator_username || 'Creator';
      const title = `${displayName} on Drandee`;
      const caption = row.caption ? truncateCaption(row.caption) : contentTypeDescription(row);
      const thumbnail = pickThumbnail(row);
      const imageUrl = thumbnail ? (thumbnail.startsWith('http') ? thumbnail : `${BASE_URL}${thumbnail}`) : `${BASE_URL}/logo192.png`;
      const canonicalUrl = `${BASE_URL}/v/${postId}`;
      const redirectUrl = `${BASE_URL}/reels?postId=${postId}`;

      // Determine OG type
      const ct = row.content_type || row.type;
      const isVideo = ct === 'video' || ct === 'reel';
      const ogType = isVideo ? 'video.other' : 'website';
      const twitterCard = 'summary_large_image';

      // Only include og:video if we have a real https video URL
      let videoUrl = null;
      if (isVideo && row.video_url) {
        const normalized = normalizeMediaUrl(row.video_url);
        if (normalized && normalized.startsWith('https://')) {
          videoUrl = normalized;
        }
      }

      const html = buildPreviewHTML({
        title,
        description: caption,
        imageUrl,
        ogUrl: canonicalUrl,
        ogType,
        twitterCard,
        redirectUrl,
        videoUrl,
      });

      res.status(200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(html);
    } catch (err) {
      // Never expose stack traces — serve generic page
      console.error('[sharePreview] error:', err.message);
      const { html } = genericPreview(500);
      res.status(500);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(html);
    }
  });

  return router;
};
