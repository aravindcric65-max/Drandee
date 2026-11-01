require("dotenv").config();

const path = require('path');
const fs = require('fs');
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const { logger } = require("./utils/logger");
const requestIdMiddleware = require("./middleware/requestId");

const { pool } = require("./config/database");

const {
  ensureRedis,
  closeRedis,
  redisEnabled,
} = require("./utils/engagementVelocity");
const { redisClient } = require("./utils/antiBot");

const feedAnalyticsRoutes = require("./routes/feedAnalytics");
const eventsRoutes = require("./routes/events");
const feedRoutes = require("./routes/feed");
const watchRoutes = require("./routes/watch");
const spotlightRoutes = require("./routes/spotlight");
const uploadRoutes = require("./routes/upload")(pool);
const userRoutes = require("./routes/user");
const engagementRoutes = require("./routes/engagement");
const postRoutes = require("./routes/posts");
const reportsRoutes = require("./routes/reports");
const feedbackRoutes = require("./routes/feedback");
const audioRoutes = require("./routes/audio");
const draftsRoutes = require("./routes/drafts");
const authRoutes = require("./routes/auth");
const homeRoutes = require("./routes/home");
const mediaRoutes = require("./routes/media")(pool);
const profileRoutes = require("./routes/profile");
const creatorAnalyticsRoutes = require("./routes/creatorAnalytics")(pool);
const settingsRoutes = require("./routes/settings");
const notificationsRoutes = require("./routes/notifications");
const securityRoutes = require("./routes/security");
const privacyRoutes = require("./routes/privacy");
const discoverRoutes = require("./routes/discover");
const bookmarksRoutes = require("./routes/bookmarks");
const dataRoutes = require("./routes/data");
const activityRoutes = require("./routes/activity");
const exportsRoutes = require("./routes/exports");
const healthRoutes = require("./routes/health")(pool, redisClient);
const searchRoutes = require("./routes/search");
const hashtagsRoutes = require("./routes/hashtags");

// ============================================
// Express App Setup
// ============================================

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

let server;
let isShuttingDown = false;

// ============================================
// Environment Validation
// ============================================

if (!process.env.JWT_SECRET) {
  logger.fatal('JWT_SECRET is missing in .env — server cannot start safely');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  logger.fatal('DATABASE_URL is missing in .env — server cannot start safely');
  process.exit(1);
}

if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
  logger.warn('ImageKit credentials missing — upload features may not work');
}

// ============================================
// Security Middleware
// ============================================

app.disable("x-powered-by");
if (NODE_ENV === "production") app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// ============================================
// CORS Configuration
// ============================================

// Build the set of explicitly allowed origins
const allowedOrigins = new Set([
  FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://localhost:5174",
]);

// Accept a comma-separated list from the environment (works in every env)
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(",").forEach((o) =>
    allowedOrigins.add(o.trim())
  );
}

// Legacy single-value helper kept for backward compatibility
if (process.env.ADDITIONAL_FRONTEND_URL) {
  allowedOrigins.add(process.env.ADDITIONAL_FRONTEND_URL);
}

const IS_DEV = process.env.NODE_ENV !== "production";

// In dev, also match any trycloudflare.com tunnel and LAN IPs on port 3000
const CLOUDFLARE_RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i;
const LAN_3000_RE = /^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:3000$/;

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin / non-browser / curl requests have no Origin header
      if (!origin || origin === "null") return callback(null, true);

      const clean = origin.trim().replace(/\/$/, "");

      if (allowedOrigins.has(clean)) return callback(null, true);

      if (IS_DEV) {
        if (CLOUDFLARE_RE.test(clean) || LAN_3000_RE.test(clean))
          return callback(null, true);
      }

      logger.warn({ origin: clean }, "CORS rejected origin");
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ============================================
// Body Parser
// ============================================

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================
// Request ID (Correlation)
// ============================================
app.use(requestIdMiddleware);

// ============================================
// HTTP Request Logging (Pino)
// ============================================
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
      method:    req.method,
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
const metricsMiddleware = require("./middleware/metrics");
app.use(metricsMiddleware);

// ============================================
// Global Rate Limiting
// ============================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// Database Connection
// ============================================

app.set("db", pool);

// ============================================
// Redis Connection
// ============================================

let redisReady = false;

ensureRedis()
  .then((client) => {
    redisReady = client.isOpen || client.isReady || false;
    if (redisReady && redisEnabled) {
      logger.info('Connected to Redis');
    } else if (!redisEnabled) {
      logger.info('Redis is disabled — running without Redis');
    }
  })
  .catch(() => {
    redisReady = false;
    logger.warn('Redis unavailable — feed will continue without velocity signals');
  });

// ============================================
// Rate Limiting
// ============================================

// trust proxy already set conditionally above (production-only)

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    error: "Too many requests. Please try again later" 
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    error: "Too many authentication attempts. Please try again later" 
  },
});

app.use("/api", generalLimiter);

// ============================================
// Mount Routes
// ============================================

app.use("/api/feed-analytics", feedAnalyticsRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/watch", watchRoutes(pool));
app.use("/api/spotlight", spotlightRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/user", userRoutes(pool));
app.use("/api/profile", profileRoutes(pool));
app.use("/api/creator", creatorAnalyticsRoutes);
app.use("/api/engagement", engagementRoutes(pool));
app.use("/api/posts", postRoutes(pool));  // ← Privacy API route
app.use("/api/events", eventsRoutes());
app.use("/api/reports", reportsRoutes(pool));
app.use("/api/feedback", feedbackRoutes(pool));
app.use("/api/audio", audioRoutes(pool));
app.use("/api/drafts", draftsRoutes(pool));
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes(pool));
app.use("/api/notifications", notificationsRoutes(pool));
app.use("/api/security", securityRoutes);
app.use("/api/privacy", privacyRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/search", searchRoutes(pool));
app.use("/api/hashtags", hashtagsRoutes(pool));
app.use("/api/hashtag", hashtagsRoutes(pool));
app.use("/api/discover", discoverRoutes(pool));
app.use("/api/bookmarks", bookmarksRoutes(pool));
app.use("/api/exports", exportsRoutes(pool, redisClient));

// ============================================
// Helper Functions
// ============================================

function createUsernameBase(name, email) {
  const namePart = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
  const emailPart = String(email || "").toLowerCase().split("@")[0].replace(/[^a-z0-9]+/g, "").slice(0, 24);
  return namePart || emailPart || "user";
}

async function createUniqueUsername(name, email) {
  const base = createUsernameBase(name, email);
  const first = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [base]);
  if (first.rows.length === 0) return base;
  
  for (let number = 1; number <= 100; number += 1) {
    const candidate = `${base}_${number}`;
    const result = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [candidate]);
    if (result.rows.length === 0) return candidate;
  }
  
  return `${base}_${Date.now()}`;
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || "audience" },
    process.env.JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRES_IN, 
      issuer: "drandee-api", 
      audience: "drandee-frontend" 
    }
  );
}

function publicUser(user) {
  return { 
    id: user.id, 
    name: user.name, 
    username: user.username || "", 
    email: user.email, 
    role: user.role || "audience", 
    bio: user.bio || "", 
    profilePic: user.profile_pic || null 
  };
}

// ============================================
// Routes
// ============================================

app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "Drandee API running", 
    version: "1.0.0", 
    environment: NODE_ENV 
  });
});

app.use("/api/health", healthRoutes);

// ============================================
// Development / Dev Seed Routes
// ============================================

if (NODE_ENV !== "production" && process.env.ENABLE_DEV_SEED === "true") {
  
  app.post("/api/dev/seed-user", authLimiter, async (req, res) => {
    try {
      const name = "Aravindan";
      const email = "test@gmail.com";
      const password = "12345678";
      
      const existing = await pool.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, 
        [email]
      );
      
      if (existing.rows.length > 0) {
        return res.json({ 
          success: true, 
          created: false, 
          message: "Dev user already exists" 
        });
      }

      const username = await createUniqueUsername(name, email);
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const result = await pool.query(
        `INSERT INTO users (name, username, email, password, role, joined_since) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id, name, username, email, role`,
        [name, username, email, hashedPassword, "audience"]
      );
      
      return res.status(201).json({ 
        success: true, 
        created: true, 
        message: "Dev user created", 
        user: result.rows[0] 
      });
    } catch (error) {
      logger.error({ err: error }, 'Dev seed-user failed');
      return res.status(500).json({
        success: false,
        error: "Seed failed. Check if 'users' table exists."
      });
    }
  });

  app.post("/api/dev/seed-posts", authLimiter, async (req, res) => {
    try {
      const userRes = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", ["test@gmail.com"]);
      
      if (userRes.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Please run /api/dev/seed-user first" 
        });
      }
      
      const userId = userRes.rows[0].id;
      const samplePosts = [
        { 
          video_url: "https://www.w3schools.com/html/mov_bbb.mp4", 
          caption: "My first journey milestone on Drandee 🚀", 
          tags: ["journey", "start"] 
        },
        { 
          video_url: "https://www.w3schools.com/html/mov_bbb.mp4", 
          caption: "Deep focus mode. Building the future. 💻", 
          tags: ["coding", "focus"] 
        },
        { 
          video_url: "https://www.w3schools.com/html/mov_bbb.mp4", 
          caption: "Morning reflections and clarity 🌅", 
          tags: ["mindset", "growth"] 
        },
        { 
          video_url: "https://www.w3schools.com/html/mov_bbb.mp4", 
          caption: "The architecture of a dream ✨", 
          tags: ["design", "architecture"] 
        },
        { 
          video_url: "https://www.w3schools.com/html/mov_bbb.mp4", 
          caption: "Connecting the constellation nodes 🌌", 
          tags: ["drandee", "community"] 
        }
      ];

      for (let post of samplePosts) {
        await pool.query(
          `INSERT INTO posts (user_id, creator_id, creator_name, video_url, caption, tags, total_respects, comment_count, share_count, save_count, watch_count, created_at)
           VALUES ($1, $1, $2, $3, $4, $5, 0, 0, 0, 0, 0, NOW())`,
          [userId, "Aravindan", post.video_url, post.caption, post.tags]
        );
      }
      
      return res.status(201).json({ 
        success: true, 
        message: "5 sample posts seeded successfully!" 
      });
    } catch (error) {
      logger.error({ err: error }, 'Dev seed-posts failed');
      return res.status(500).json({
        success: false,
        error: "Failed to seed posts. Check if 'posts' table exists."
      });
    }
  });
}

// ============================================
// Active Users Tracking (development only)
// ============================================

const activeUsers = new Map();

if (NODE_ENV !== "production") {
  app.get("/api/active-users", (req, res) => {
    const now = Date.now();
    for (const [userId, data] of activeUsers.entries()) {
      if (now - new Date(data.lastActive).getTime() > 5 * 60 * 1000) {
        activeUsers.delete(userId);
      }
    }

    return res.json({
      success: true,
      count: activeUsers.size,
      users: Array.from(activeUsers.values())
    });
  });

  app.post("/api/track-active", (req, res) => {
    const { userId, name } = req.body;
    if (userId && name) {
      activeUsers.set(userId, {
        id: userId,
        name,
        lastActive: new Date().toISOString()
      });
    }
    return res.json({ success: true });
  });
}

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
    let imageUrl = 'https://drandee.app/logo192.png';
    let ogUrl = `https://drandee.app${req.path}`;
    let type = isReel ? 'video.other' : 'profile';

    if (isReel) {
      if (!isNaN(id)) {
        try {
          const postResult = await pool.query('SELECT id, caption, image_url, video_url, created_at, creator_name, creator_id FROM posts WHERE id = $1 LIMIT 1', [id]);
          if (postResult.rows.length > 0) {
            const post = postResult.rows[0];
            title = 'Drandee Reel';
            description = post.caption || description;
            imageUrl = post.image_url || `https://drandee.app/api/reels/${id}/thumbnail`;
          }
        } catch(e) {}
      }
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
      } catch(e) {}
    }

    const escapeHtml = (unsafe) => {
      if (!unsafe) return '';
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
      
    let uploadDate = new Date().toISOString();
    let authorName = null;
    let authorUrl = null;

    if (isReel && title !== 'Drandee' && !isNaN(id)) {
      try {
        const postResult = await pool.query('SELECT created_at, creator_name, creator_id FROM posts WHERE id = $1 LIMIT 1', [id]);
        if (postResult.rows.length > 0) {
           if (postResult.rows[0].created_at) uploadDate = new Date(postResult.rows[0].created_at).toISOString();
           if (postResult.rows[0].creator_name) authorName = postResult.rows[0].creator_name;
           if (postResult.rows[0].creator_id) authorUrl = `https://drandee.app/creator/${postResult.rows[0].creator_id}`;
        }
      } catch(e) {}
    }
      
    const canonicalTag = `<link rel="canonical" href="${eUrl}" />`;
    
    const schemas = [];

    schemas.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Drandee",
      "url": "https://drandee.app/"
    });

    if (isReel && title !== 'Drandee') {
      const videoSchema = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": title,
        "description": description,
        "thumbnailUrl": imageUrl,
        "uploadDate": uploadDate,
        "url": ogUrl,
        "publisher": {
          "@type": "Organization",
          "name": "Drandee",
          "logo": {
            "@type": "ImageObject",
            "url": "https://drandee.app/logo192.png"
          }
        }
      };
      if (authorName) {
        videoSchema.author = {
          "@type": "Person",
          "name": authorName,
          "url": authorUrl || ogUrl
        };
      }
      schemas.push(videoSchema);
    } else if (isCreator && title !== 'Drandee') {
      const rawName = title.replace(' on Drandee', '');
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Person",
        "name": rawName,
        "description": description,
        "image": imageUrl,
        "url": ogUrl
      });
    }

    const safeJsonLd = JSON.stringify(schemas).replace(/<\//g, "<\\/");
    const schemaTag = `<script type="application/ld+json">\n${safeJsonLd}\n</script>`;

    if (html.includes('</head>')) {
      html = html.replace('</head>', `  ${canonicalTag}\n  ${schemaTag}\n  </head>`);
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(html);
  } catch (error) {
    logger.error({ err: error, path: req.path }, 'SEO interception failed');
    next();
  }
};

app.get('/reel/:id', seoInterceptor);
app.get('/creator/:id', seoInterceptor);

// ============================================
// SEO / Sitemap & Robots
// ============================================

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /settings/
Disallow: /private/

Sitemap: https://drandee.app/sitemap.xml
`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const urls = [];
    
    urls.push({
      loc: 'https://drandee.app/',
      changefreq: 'always',
      priority: '1.0'
    });

    const usersResult = await pool.query(`
      SELECT id, updated_at 
      FROM users 
      WHERE is_protected = false 
      ORDER BY id DESC 
      LIMIT 10000
    `);
    
    usersResult.rows.forEach(user => {
      let lastmod = '';
      if (user.updated_at) {
        lastmod = `<lastmod>${new Date(user.updated_at).toISOString()}</lastmod>`;
      }
      urls.push({
        loc: `https://drandee.app/creator/${user.id}`,
        lastmodRaw: lastmod,
        changefreq: 'daily',
        priority: '0.8'
      });
    });

    const postsResult = await pool.query(`
      SELECT id, created_at 
      FROM posts 
      WHERE is_deleted = false AND is_private = false 
      ORDER BY id DESC 
      LIMIT 10000
    `);

    postsResult.rows.forEach(post => {
      let lastmod = '';
      if (post.created_at) {
        lastmod = `<lastmod>${new Date(post.created_at).toISOString()}</lastmod>`;
      }
      urls.push({
        loc: `https://drandee.app/reel/${post.id}`,
        lastmodRaw: lastmod,
        changefreq: 'weekly',
        priority: '0.9'
      });
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    urls.forEach(u => {
      xml += '  <url>\n';
      xml += `    <loc>${u.loc}</loc>\n`;
      if (u.lastmodRaw) xml += `    ${u.lastmodRaw}\n`;
      if (u.changefreq) xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      if (u.priority) xml += `    <priority>${u.priority}</priority>\n`;
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
// 404 Handler - MUST BE LAST!
// ============================================

app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: "Route not found" 
  });
});

// ============================================
// Error Handling
// ============================================

app.use((error, req, res, _next) => {
  logger.error({
    requestId: req.requestId,
    err: error,
    method: req.method,
    route: req.path,
  }, 'Unhandled server error');

  if (redisClient) {
    redisClient.incr('metrics:5xx_total').catch((err) => {
      logger.warn({ err }, 'Failed to track 5xx error in Redis');
    });
  }

  return res.status(500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    ...(NODE_ENV !== 'production' && { stack: error.stack }),
  });
});

// ============================================
// Graceful Shutdown
// ============================================

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received');

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced exit after 10s timeout');
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
    if (redisReady && redisEnabled) {
      await closeRedis();
    }
    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Shutdown error');
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

// ============================================
// Start Server
// ============================================

async function startServer() {
  try {
    await pool.query('SELECT 1');
    logger.info('Connected to database');

    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info({
        port: PORT,
        env: NODE_ENV,
        redis: redisEnabled ? (redisReady ? 'connected' : 'unavailable') : 'disabled',
      }, 'Drandee API server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Database connection failed — server cannot start');
    process.exit(1);
  }
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.fatal({ err: error }, 'Server start failed');
    process.exit(1);
  });
}

module.exports = { app };