const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Simple AI caption generator (using OpenAI API)
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { keywords, tone = 'viral' } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Keywords are required',
      });
    }

    // Simulate AI generation (replace with actual OpenAI/Gemini API call)
    const generatedCaption = generateAICaption(keywords, tone);

    res.json({
      success: true,
      caption: generatedCaption.caption,
      hashtags: generatedCaption.hashtags,
    });
  } catch (error) {
    console.error('AI caption error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate caption',
    });
  }
});

// Simple AI caption generator function
function generateAICaption(keywords, tone) {
  const viralPhrases = [
    "You won't believe this! 🔥",
    "This is insane! 🤯",
    "Wait for it... 😱",
    "Game changer! 💯",
    "Mind = Blown 🤯",
  ];

  const engagingPhrases = [
    "Check this out! 👀",
    "Must watch! 🎬",
    "So satisfying! ✨",
    "Pure magic! 🪄",
    "Epic moment! 🎯",
  ];

  const phrases = tone === 'viral' ? viralPhrases : engagingPhrases;
  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

  const caption = `${randomPhrase} ${keywords.join(' ')} - You have to see this!`;

  // Generate relevant hashtags
  const hashtags = keywords.map(k => `#${k.replace(/\s/g, '')}`);
  hashtags.push('#viral', '#trending', '#fyp', '#explore');

  return {
    caption,
    hashtags: hashtags.slice(0, 8), // Limit to 8 hashtags
  };
}

module.exports = router;