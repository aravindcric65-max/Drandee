'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { logger } = require('./utils/logger');
const requestIdMiddleware = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const { pool } = require('./config/database');
const { redisClient } = require('./utils/antiBot');

// Route modules
const feedAnalyticsRoutes = require('./routes/feedAnalytics');
const eventsRoutes = require('./routes/events');
const feedRoutes = require('./routes/feed');
const watchRoutes = require('./routes/watch');
const spotlightRoutes = require('./routes/spotlight');
const uploadRoutes = require('./routes/upload')(pool);
const userRoutes = require('./routes/user');
const engagementRoutes = require('./routes/engagement');
const postRoutes = require('./routes/posts');
const reportsRoutes = require('./routes/reports');
const feedbackRoutes = require('./routes/feedback');
const audioRoutes = require('./routes/audio');
const draftsRoutes = require('./routes/drafts');
const authRoutes = require('./routes/auth');
const homeRoutes = require('./routes/home');
const mediaRoutes = require('./routes/media')(pool);
const profileRoutes = require('./routes/profile');
const creatorAnalyticsRoutes = require('./routes/creatorAnalytics')(pool);
const settingsRoutes = require('./routes/settings');
const notificationsRoutes = require('./routes/notifications');
const securityRoutes = require('./routes/security');
const privacyRoutes = require('./routes/privacy');
const discoverRoutes = require('./routes/discover');
const bookmarksRoutes = require('./routes/bookmarks');
const dataRoutes = require('./routes/data');
const activityRoutes = require('./routes/activity');
const exportsRoutes = require('./routes/exports');
const healthRoutes = require('./routes/health')(pool, redisClient);
const searchRoutes = require('./routes/search');
const hashtagsRoutes = require('./routes/hashtags');
const abuseRoutes = require('./routes/abuse')(pool, redisClient);
const adminRoutes = require('./routes/admin')(pool);
const aiCaptionRoutes = require('./routes/ai-caption');
const analyticsRoutes = require('./routes/analytics')(pool);
const sharePreviewRoutes = require('./routes/sharePreview')(pool);

const app = express();

const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.set('db', pool);

// ============================================
// Security Middleware
// ============================================
app.disable('x-powered-by');
// Set trust proxy if in production OR if RATE_LIMIT_TRUST_PROXY is explicitly set (e.g. for tunnels/Cloudflare in dev)
if (NODE_ENV === 'production' || process.env.RATE_LIMIT_TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ============================================
// CORS Configuration
// ============================================
const allowedOrigins = new Set([
  FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://localhost:5174',
]);

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach((o) => allowedOrigins.add(o.trim()));
}
if (process.env.ADDITIONAL_FRONTEND_URL) {
  allowedOrigins.add(process.env.ADDITIONAL_FRONTEND_URL);
}

const IS_DEV = NODE_ENV !== 'production';
const CLOUDFLARE_RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i;
const LAN_3000_RE = /^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:3000$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === 'null') return callback(null, true);
      const clean = origin.trim().replace(/\/$/, '');
      if (allowedOrigins.has(clean)) return callback(null, true);
      if (IS_DEV && (CLOUDFLARE_RE.test(clean) || LAN_3000_RE.test(clean))) {
        return callback(null, true);
      }
      logger.warn({ origin: clean }, 'CORS rejected origin');
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// ============================================
// Body Parsing
// ============================================
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Correlation ID & Pino HTTP Request Logging
// ============================================
app.use(requestIdMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level =
      res.statusCode >= 500 ? 'error' :
      res.statusCode >= 400 ? 'warn' : 'info';
    const route = (req.route ? req.route.path : req.path).replace(/\/\d+/g, '/:id');
    logger[level]({
      requestId: req.requestId,
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
    }, 'http request');
  });
  next();
});

// ============================================
// Metrics Middleware
// ============================================
const metricsMiddleware = require('./middleware/metrics');
app.use(metricsMiddleware);

// ============================================
// Static Uploads Serving
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// Global API Rate Limiter
// ============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many requests. Please try again later',
      code: 'RATE_LIMITED',
    },
  },
});
app.use('/api', generalLimiter);

// ============================================
// Health Endpoints (Render / K8s Probes)
// ============================================
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// ============================================
// Canonical API Routes Mount
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/feed-analytics', feedAnalyticsRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/watch', watchRoutes(pool));
app.use('/api/spotlight', spotlightRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/user', userRoutes(pool));
app.use('/api/profile', profileRoutes(pool));
app.use('/api/creator', creatorAnalyticsRoutes);
app.use('/api/engagement', engagementRoutes(pool));
app.use('/api/posts', postRoutes(pool));
app.use('/api/events', eventsRoutes());
app.use('/api/reports', reportsRoutes(pool));
app.use('/api/feedback', feedbackRoutes(pool));
app.use('/api/audio', audioRoutes(pool));
app.use('/api/drafts', draftsRoutes(pool));
app.use('/api/settings', settingsRoutes(pool));
app.use('/api/notifications', notificationsRoutes(pool));
app.use('/api/security', securityRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/search', searchRoutes(pool));
app.use('/api/hashtags', hashtagsRoutes(pool));
app.use('/api/hashtag', hashtagsRoutes(pool)); // Alias
app.use('/api/discover', discoverRoutes(pool));
app.use('/api/bookmarks', bookmarksRoutes(pool));
app.use('/api/exports', exportsRoutes(pool, redisClient));
app.use('/api/abuse', abuseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai-caption', aiCaptionRoutes);
app.use('/api/analytics', analyticsRoutes);

// ============================================
// Root API Info
// ============================================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Drandee API running',
    version: '1.0.0',
    environment: NODE_ENV,
  });
});

// ============================================
// Share Preview (public, no auth) — /v/:id
// Serves crawler-friendly HTML with OG + Twitter metadata.
// Real browsers are redirected to /reels?postId=<id>.
// ============================================
app.use('/v', sharePreviewRoutes);

// ============================================
// SEO / Social Preview Interceptor
// ============================================
const seoInterceptor = async (req, res, next) => {
  try {
    const isReel = req.path.startsWith('/reel/');
    const isCreator = req.path.startsWith('/creator/');
    const id = req.params.id;

    let indexPath = path.join(__dirname, '../frontend/build/index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(__dirname, '../frontend/public/index.html');
    }

    if (!fs.existsSync(indexPath)) {
      return next();
    }

    let html = fs.readFileSync(indexPath, 'utf8');
    let title = 'Drandee';
    let description = 'Check out this content on Drandee!';
    const SEO_BASE = process.env.PUBLIC_BASE_URL || 'https://drandee.vercel.app';
    let imageUrl = `${SEO_BASE}/logo192.png`;
    let ogUrl = `${SEO_BASE}${req.path}`;
    let type = isReel ? 'video.other' : 'profile';

    if (isReel && !isNaN(id)) {
      try {
        const postResult = await pool.query(
          'SELECT id, caption, image_url, video_url, created_at, creator_name, creator_id FROM posts WHERE id = $1 LIMIT 1',
          [id]
        );
        if (postResult.rows.length > 0) {
          const post = postResult.rows[0];
          title = 'Drandee Reel';
          description = post.caption || description;
          imageUrl = post.image_url || `${SEO_BASE}/logo192.png`;
        }
      } catch (e) {}
    } else if (isCreator) {
      try {
        let userResult;
        if (isNaN(id)) {
          userResult = await pool.query('SELECT id, name, username, bio, profile_pic FROM users WHERE username = $1 LIMIT 1', [id]);
        } else {
          userResult = await pool.query('SELECT id, name, username, bio, profile_pic FROM users WHERE id = $1 LIMIT 1', [id]);
        }
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          const displayName = user.name || user.username || 'Creator';
          title = `${displayName} on Drandee`;
          description = user.bio || `Check out ${displayName}'s profile on Drandee!`;
          imageUrl = user.profile_pic || imageUrl;
        }
      } catch (e) {}
    }

    const escapeHtml = (unsafe) => {
      if (!unsafe) return '';
      return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const eTitle = escapeHtml(title);
    const eDesc = escapeHtml(description);
    const eImage = escapeHtml(imageUrl);
    const eUrl = escapeHtml(ogUrl);

    html = html
      .replace(/<title>.*?<\/title>/gi, `<title>${eTitle}</title>`)
      .replace(/<meta name="description" content=".*?"/gi, `<meta name="description" content="${eDesc}"`)
      .replace(/<meta property="og:title" content=".*?"/gi, `<meta property="og:title" content="${eTitle}"`)
      .replace(/<meta property="og:description" content=".*?"/gi, `<meta property="og:description" content="${eDesc}"`)
      .replace(/<meta property="og:image" content=".*?"/gi, `<meta property="og:image" content="${eImage}"`)
      .replace(/<meta property="og:url" content=".*?"/gi, `<meta property="og:url" content="${eUrl}"`)
      .replace(/<meta property="og:type" content=".*?"/gi, `<meta property="og:type" content="${type}"`)
      .replace(/<meta name="twitter:title" content=".*?"/gi, `<meta name="twitter:title" content="${eTitle}"`)
      .replace(/<meta name="twitter:description" content=".*?"/gi, `<meta name="twitter:description" content="${eDesc}"`)
      .replace(/<meta name="twitter:image" content=".*?"/gi, `<meta name="twitter:image" content="${eImage}"`);

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(html);
  } catch (error) {
    logger.error({ err: error, path: req.path }, 'SEO interception failed');
    next();
  }
};

// Backward compatibility: /reel/:id and /post/:id redirect to /v/:id
app.get('/reel/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isInteger(id) && id > 0) {
    return res.redirect(301, `${process.env.PUBLIC_BASE_URL || 'https://drandee.vercel.app'}/v/${id}`);
  }
  return res.redirect(301, `${process.env.PUBLIC_BASE_URL || 'https://drandee.vercel.app'}/feed`);
});
app.get('/post/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isInteger(id) && id > 0) {
    return res.redirect(301, `${process.env.PUBLIC_BASE_URL || 'https://drandee.vercel.app'}/v/${id}`);
  }
  return res.redirect(301, `${process.env.PUBLIC_BASE_URL || 'https://drandee.vercel.app'}/feed`);
});
app.get('/creator/:id', seoInterceptor);

// ============================================
// SEO / Robots & Sitemap
// ============================================
app.get('/robots.txt', (req, res) => {
  const BASE = process.env.PUBLIC_BASE_URL || 'https://drandee.vercel.app';
  res.type('text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(
    `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /settings\nDisallow: /login\n\nSitemap: ${BASE}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const BASE = process.env.PUBLIC_BASE_URL || 'https://drandee.vercel.app';
    const urls = [{ loc: `${BASE}/`, changefreq: 'always', priority: '1.0' }];

    const usersResult = await pool.query(
      `SELECT username, updated_at FROM users
       WHERE is_protected = false
         AND account_status != 'BANNED'
         AND username IS NOT NULL
         AND username != ''
       ORDER BY id DESC
       LIMIT 5000`
    );

    usersResult.rows.forEach(u => {
      urls.push({
        loc: `${BASE}/u/${encodeURIComponent(u.username)}`,
        lastmod: u.updated_at ? new Date(u.updated_at).toISOString() : null,
        changefreq: 'weekly',
        priority: '0.7',
      });
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach(u => {
      xml += '  <url>\n';
      xml += `    <loc>${u.loc}</loc>\n`;
      if (u.lastmod) xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      xml += `    <priority>${u.priority}</priority>\n`;
      xml += '  </url>\n';
    });
    xml += '</urlset>';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
  } catch (err) {
    logger.error({ err }, 'Sitemap generation failed');
    res.status(500).send('Internal Server Error generating sitemap');
  }
});

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
  });
});

// ============================================
// Central Error Handler - MUST BE LAST!
// ============================================
app.use(errorHandler);

module.exports = app;
