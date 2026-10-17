import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Hash, Sparkles, RotateCcw, Smile, User } from 'lucide-react';

const CaptionAssistant = ({ onNext, onBack, onSave, initialCaption = '' }) => {
  const [caption, setCaption] = useState(initialCaption);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);

  const emojis = [
    '😂', '❤️', '🔥', '👏', '😍', '🤩', '💯', '✨', '😎', '🙌',
    '👋', '💪', '🎉', '😭', '🥺', '😅', '🤣', '😊', '👀', '💬',
    '🫶', '💥', '🌟', '🎯', '💎', '🙏', '⚡', '🎵', '🏆', '🫡',
  ];

  const hashtags = [
    '#viral', '#trending', '#fyp', '#explore', '#reels',
    '#video', '#content', '#creator', '#socialmedia', '#fun',
  ];

  const addEmoji = (emoji) => {
    setCaption(caption + emoji);
    setShowEmojiPicker(false);
  };

  const addHashtag = (tag) => {
    setCaption(caption + ' ' + tag);
  };

  const generateAICaption = async () => {
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      const suggestions = [
        {
          caption: 'Living my best life! ✨',
          hashtags: ['#lifestyle', '#vibes', '#blessed'],
        },
        {
          caption: 'New adventure begins here 🚀',
          hashtags: ['#adventure', '#journey', '#explore'],
        },
        {
          caption: 'Creating memories that last 💫',
          hashtags: ['#memories', '#moments', '#life'],
        },
      ];
      setAiSuggestions(suggestions[Math.floor(Math.random() * suggestions.length)]);
      setIsGenerating(false);
    }, 1500);
  };

  const applyAISuggestion = () => {
    if (aiSuggestions) {
      setCaption(aiSuggestions.caption + ' ' + aiSuggestions.hashtags.join(' '));
      setAiSuggestions(null);
    }
  };

  const maxLength = 150;
  const remainingChars = maxLength - caption.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-screen bg-[#0a0a0f]"
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/5 transition-all"
        >
          <RotateCcw className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold text-lg">Caption</span>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all"
        >
          Next
        </button>
      </div>

      {/* Caption Input */}
      <div className="p-4">
        <div className="bg-white/5 rounded-2xl p-4">
          <label className="text-gray-400 text-sm mb-2 block">
            Write a caption...
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, maxLength))}
            placeholder="Share what's on your mind..."
            rows={4}
            className="w-full bg-transparent text-white text-lg resize-none focus:outline-none placeholder-gray-600"
          />
          
          {/* Character Counter */}
          <div className="flex justify-between items-center mt-2">
            <span className={`text-xs ${remainingChars < 20 ? 'text-red-400' : 'text-gray-500'}`}>
              {remainingChars} characters left
            </span>
          </div>
        </div>
      </div>

      {/* AI Assist */}
      <div className="px-4 pb-4">
        <button
          onClick={generateAICaption}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/30 transition-all disabled:opacity-50"
        >
          <Sparkles className={`w-5 h-5 ${isGenerating ? 'animate-pulse' : ''}`} />
          {isGenerating ? 'Generating...' : 'Help me write'}
        </button>

        {/* AI Suggestion */}
        {aiSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-primary/10 border border-primary/30 rounded-xl p-4"
          >
            <p className="text-white text-sm mb-2">{aiSuggestions.caption}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {aiSuggestions.hashtags.map((tag) => (
                <span key={tag} className="text-primary text-xs">
                  {tag}
                </span>
              ))}
            </div>
            <button
              onClick={applyAISuggestion}
              className="text-xs bg-primary text-white px-4 py-2 rounded-full hover:bg-primary/80 transition-all"
            >
              Use this
            </button>
          </motion.div>
        )}
      </div>

      {/* Emoji Picker */}
      <div className="px-4 pb-4">
        <div className="bg-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Smile className="w-4 h-4" />
              Emojis
            </h3>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-primary text-sm font-medium"
            >
              {showEmojiPicker ? 'Hide' : 'Show'}
            </button>
          </div>

          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-6 gap-2"
            >
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  className="text-2xl hover:bg-white/10 rounded-lg p-2 transition-all"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Hashtags */}
      <div className="px-4 pb-4">
        <div className="bg-white/5 rounded-2xl p-4">
          <h3 className="text-white font-medium flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4" />
            Trending Hashtags
          </h3>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <button
                key={tag}
                onClick={() => addHashtag(tag)}
                className="text-primary text-sm bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-all"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mentions */}
      <div className="px-4 pb-4">
        <div className="bg-white/5 rounded-2xl p-4">
          <h3 className="text-white font-medium flex items-center gap-2 mb-3">
            <User className="w-4 h-4" />
            Mention People
          </h3>
          <p className="text-gray-400 text-sm">
            Type @ to mention someone in your caption
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={onSave}
          className="w-full bg-gradient-to-r from-primary to-secondary text-white font-semibold py-4 rounded-xl hover:opacity-90 transition-all"
        >
          Save Caption
        </button>
      </div>
    </motion.div>
  );
};

export default CaptionAssistant;