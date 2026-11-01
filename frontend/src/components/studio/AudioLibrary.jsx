import React, { useState, useEffect } from 'react';
import { parseApiResponse } from '../../utils/apiHelper';

const AudioLibrary = ({ onSelectAudio, onClose }) => {
  const [audios, setAudios] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudios();
  }, []);

  const fetchAudios = async () => {
    try {
      const response = await fetch('/api/audio/library');
      const data = await parseApiResponse(response, "Fetch Audios");
      if (data.success) {
        setAudios(data.audios);
      }
    } catch (error) {
      console.error('Fetch audios error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length > 2) {
      try {
        const response = await fetch(`/api/audio/search?q=${encodeURIComponent(query)}`);
        const data = await parseApiResponse(response, "Search Audios");
        if (data.success) {
          setAudios(data.audios);
        }
      } catch (error) {
        console.error('Search audios error:', error);
      }
    } else {
      fetchAudios();
    }
  };

  return (
    <div className="audio-library-modal absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="modal-content bg-gray-900 w-full max-w-lg rounded-2xl border border-gray-800 shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="modal-header p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Select Audio</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="search-bar p-4">
          <input
            type="text"
            placeholder="Search audio..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="audio-list overflow-y-auto p-2 flex-1">
          {loading ? (
            <div className="text-center text-gray-400 p-8">Loading...</div>
          ) : audios.length === 0 ? (
            <div className="text-center text-gray-400 p-8">No audios found.</div>
          ) : (
            audios.map((audio) => (
              <div
                key={audio.id}
                className="audio-item flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                onClick={() => onSelectAudio(audio)}
              >
                <img
                  src={audio.thumbnail_url || 'https://placehold.co/150/111/444'}
                  alt={audio.name}
                  className="audio-thumbnail w-12 h-12 rounded-lg object-cover"
                />
                <div className="audio-info flex-1">
                  <div className="audio-name text-white font-medium">{audio.name}</div>
                  <div className="audio-artist text-gray-400 text-sm">{audio.artist || 'Unknown'}</div>
                  <div className="audio-usage text-gray-500 text-xs">{audio.usage_count} reels</div>
                </div>
                <audio
                  src={audio.audio_url}
                  controls
                  className="audio-preview w-32 h-8"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioLibrary;
