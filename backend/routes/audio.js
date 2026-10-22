const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

module.exports = (pool) => {
  const router = express.Router();
  const { trackAction } = require("../utils/engagementVelocity");

  // GET /api/audio/library - Get all audios
  router.get("/library", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM audios ORDER BY usage_count DESC, created_at DESC LIMIT 50`
      );
      return res.json({
        success: true,
        audios: result.rows
      });
    } catch (error) {
      console.error('Audio library error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load audio library'
      });
    }
  });

  const AUDIO_LIBRARY = [
    {
      id: 9991,
      name: 'Lofi Chill Beat',
      artist: 'Drandee Sounds',
      duration: 145,
      language: 'en',
      thumbnail_url: 'https://images.unsplash.com/photo-1516280440502-85949d97a5ce?w=200&h=200&fit=crop',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      usage_count: 1540
    },
    {
      id: 9992,
      name: 'Kuthu Fire (Tamil)',
      artist: 'Drandee Beats',
      duration: 120,
      language: 'ta',
      thumbnail_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=200&h=200&fit=crop',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      usage_count: 980
    },
    {
      id: 9993,
      name: 'Cinematic Epic',
      artist: 'Drandee Orchestral',
      duration: 180,
      language: 'en',
      thumbnail_url: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      usage_count: 850
    },
    {
      id: 9994,
      name: 'Electronic Dance',
      artist: 'Drandee EDM',
      duration: 200,
      language: 'en',
      thumbnail_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      usage_count: 520
    },
    {
      id: 9995,
      name: 'Melody Love (Tamil)',
      artist: 'Drandee Strings',
      duration: 180,
      language: 'ta',
      thumbnail_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop',
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      usage_count: 320
    }
  ];

  // GET /api/audio/trending - Get trending audios
  router.get("/trending", async (req, res) => {
    try {
      const { query = '', language } = req.query;
      
      let filtered = AUDIO_LIBRARY;
      
      if (language) {
        // Simple algorithm: prioritize user's language, then mix in others
        const langCode = language.toLowerCase().substring(0, 2);
        const userLangSongs = filtered.filter(a => a.language === langCode);
        const otherLangSongs = filtered.filter(a => a.language !== langCode);
        filtered = [...userLangSongs, ...otherLangSongs];
      }
      
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        filtered = filtered.filter(a => 
          a.name.toLowerCase().includes(q) || 
          a.artist.toLowerCase().includes(q)
        );
      }
      
      return res.json({
        success: true,
        audios: filtered
      });
    } catch (error) {
      console.error('Trending audio error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load trending audios'
      });
    }
  });

  // GET /api/audio/:id - Get audio details
  router.get("/:id", async (req, res) => {
    try {
      const audioId = parseInt(req.params.id, 10);
      const result = await pool.query(
        `SELECT * FROM audios WHERE id = $1`,
        [audioId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Audio not found'
        });
      }
      return res.json({
        success: true,
        audio: result.rows
      });
    } catch (error) {
      console.error('Audio details error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load audio details'
      });
    }
  });

  // GET /api/audio/:id/reels - Get reels using this audio
  router.get("/:id/reels", authMiddleware, async (req, res) => {
    try {
      const audioId = parseInt(req.params.id, 10);
      const userId = req.auth.userId;

      const result = await pool.query(
        `SELECT p.*, u.name AS creator_name FROM posts p 
         LEFT JOIN users u ON COALESCE(p.user_id, p.creator_id) = u.id
         WHERE p.audio_id = $1 AND p.is_deleted = false
         ORDER BY p.created_at DESC LIMIT 50`,
        [audioId]
      );

      // Fire impressions asynchronously
      if (result.rows.length > 0) {
        Promise.all(result.rows.map(reel => 
          trackAction(userId, 'impression', { 
            postId: reel.id, 
            source: 'audio_feed',
            audioId: audioId 
          })
        )).catch(err => console.error("Reel impression tracking error:", err.message));
      }

      return res.json({
        success: true,
        reels: result.rows
      });
    } catch (error) {
      console.error('Audio reels error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load reels'
      });
    }
  });

  // GET /api/audio/search?q=... - Search audios
  router.get("/search", async (req, res) => {
    try {
      const query = req.query.q || '';
      const result = await pool.query(
        `SELECT * FROM audios 
         WHERE name ILIKE $1 OR artist ILIKE $1
         ORDER BY usage_count DESC
         LIMIT 20`,
        [`%${query}%`]
      );
      return res.json({
        success: true,
        audios: result.rows
      });
    } catch (error) {
      console.error('Audio search error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search audios'
      });
    }
  });

  // POST /api/audio/upload - Upload new audio (auth required)
  router.post("/upload", authMiddleware, async (req, res) => {
    try {
      const { name, artist, audio_url, duration, thumbnail_url } = req.body;
      const userId = req.auth.userId;

      if (!name || !audio_url) {
        return res.status(400).json({
          success: false,
          error: 'Name and audio_url are required'
        });
      }

      const result = await pool.query(
        `INSERT INTO audios (name, artist, audio_url, duration, thumbnail_url, user_id, is_original)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING *`,
        [name, artist || '', audio_url, duration || 0, thumbnail_url || '', userId]
      );

      return res.status(201).json({
        success: true,
        audio: result.rows
      });
    } catch (error) {
      console.error('Audio upload error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload audio'
      });
    }
  });

  return router;
};
