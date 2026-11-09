/**
 * Canonical SEO configuration.
 * Single source of truth for all public-facing URLs.
 * Import this wherever you need the base URL — never hardcode drandee.app.
 */

// The canonical production origin. Must be https, no trailing slash.
export const CANONICAL_ORIGIN = 'https://drandee.vercel.app';

// Build a canonical share URL for a post
export const postUrl = (id) => `${CANONICAL_ORIGIN}/v/${id}`;

// Build a canonical profile URL
export const profileUrl = (username) => `${CANONICAL_ORIGIN}/u/${encodeURIComponent(username)}`;

// Build a canonical hashtag URL
export const tagUrl = (tag) => `${CANONICAL_ORIGIN}/tag/${encodeURIComponent(tag)}`;

// Default OG image (1200×630 expected)
export const DEFAULT_OG_IMAGE = `${CANONICAL_ORIGIN}/logo192.png`;
