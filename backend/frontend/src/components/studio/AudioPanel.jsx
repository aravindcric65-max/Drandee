import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Play, Pause, Volume2, Check, Music, Mic2 } from 'lucide-react';

const AudioPanel = ({ onNext, onBack, onSave }) => {
  const [activeCategory, setActiveCategory] = useState('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [originalSound, setOriginalSound] = useState(true);
  const [musicVolume, setMusicVolume] = useState(50);

  const categories = [
    'Trending',
    'Tamil',
    'English',
    'Lo-fi',
    'Instrumental',
    'Travel',
    'Love',
    'Sad',
    'Happy',
    'Motivation',
    'Beats',
    'Chill',
  ];

  const tracks = [
    {
      id: 1,
      title: 'Summer Vibes',
      artist: 'DJ Cool',
      duration: '2:45',
      category: 'Trending',
      cover: '🎵',
    },
    {
      id: 2,
      title: 'Night Drive',
      artist: 'Synthwave',
      duration: '3:12',
      category: 'Trending',
      cover: '🌙',
    },
    {
      id: 3,
      title: 'Chill Beats',
      artist: 'Lo-fi Girl',
      duration: '2:30',
      category: 'Lo-fi',
      cover: '🎧',
    },
    {
      id: 4,
      title: 'Motivation',
      artist: 'Power Music',
      duration: '3:00',
      category: 'Motivation',
      cover: '💪',
    },
    {
      id: 5,
      title: 'Romantic',
      artist: 'Love Songs',
      duration: '3:45',
      category: 'Love',
      cover: '❤️',
    },
    {
      id: 6,
      title: 'Sad Melody',
      artist: 'Emotional',
      duration: '2:55',
      category: 'Sad',
      cover: '😢',
    },
  ];

  const filteredTracks = tracks.filter(
    (track) =>
      track.category === activeCategory &&
      (track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const togglePlay = (id) => {
    setPlayingId(playingId === id ? null : id);
  };

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
          <Music className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-semibold text-lg">Add Sound</span>
        <button
          onClick={onNext}
          disabled={!selectedTrack}
          className="px-6 py-2 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search songs or artists"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === category
                  ? 'bg-gradient-to-r from-primary to-secondary text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Music className="w-16 h-16 mb-4 opacity-20" />
            <p>No tracks found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTracks.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                  selectedTrack?.id === track.id
                    ? 'bg-primary/20 border border-primary/50'
                    : 'bg-white/5 hover:bg-white/10 border border-white/5'
                }`}
                onClick={() => setSelectedTrack(track)}
              >
                {/* Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay(track.id);
                  }}
                  className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  {playingId === track.id ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  )}
                </button>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{track.title}</h4>
                  <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                </div>

                {/* Duration */}
                <span className="text-gray-500 text-sm">{track.duration}</span>

                {/* Selected Indicator */}
                {selectedTrack?.id === track.id && (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Sound Settings */}
      <div className="bg-white/5 border-t border-white/5 px-4 py-4 space-y-4">
        {/* Original Sound Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mic2 className="w-5 h-5 text-gray-400" />
            <span className="text-white font-medium">Original Sound</span>
          </div>
          <button
            onClick={() => setOriginalSound(!originalSound)}
            className={`relative w-12 h-6 rounded-full transition-all ${
              originalSound ? 'bg-primary' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                originalSound ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Music Volume Slider */}
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-gray-400" />
          <input
            type="range"
            min="0"
            max="100"
            value={musicVolume}
            onChange={(e) => setMusicVolume(Number(e.target.value))}
            className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <span className="text-gray-400 text-sm w-8">{musicVolume}%</span>
        </div>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={!selectedTrack}
          className="w-full bg-gradient-to-r from-primary to-secondary text-white font-semibold py-4 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedTrack ? `Use "${selectedTrack.title}"` : 'Select a track'}
        </button>
      </div>
    </motion.div>
  );
};

export default AudioPanel;