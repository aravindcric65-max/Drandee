import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon } from 'lucide-react';

const MediaPicker = ({ onMediaSelect, onCancel }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate files
    const validFiles = [];
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png'];
    const maxSize = 100 * 1024 * 1024; // 100MB

    for (let file of files) {
      if (!validTypes.includes(file.type)) {
        alert('Some files are unsupported. Please choose MP4, MOV, WebM, JPG, or PNG.');
        continue;
      }
      if (file.size > maxSize) {
        alert('File is too large. Max 100MB per file.');
        continue;
      }
      validFiles.push({
        file,
        url: URL.createObjectURL(file),
        id: Math.random().toString(36).substring(7)
      });
    }

    if (selectedFiles.length + validFiles.length > 10) {
      alert('You can only select up to 10 items.');
      validFiles.splice(10 - selectedFiles.length);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (id) => {
    setSelectedFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      // Clean up object URL
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return filtered;
    });
  };

  const handleContinue = () => {
    if (selectedFiles.length > 0) {
      onMediaSelect(selectedFiles);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0a0a0f] z-[1000] flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10 pt-safe">
        <button onClick={onCancel} className="text-white p-2">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-bold text-lg">Select Media</h2>
        <button 
          onClick={handleContinue}
          disabled={selectedFiles.length === 0}
          className={`px-4 py-1.5 rounded-full font-semibold transition-all ${
            selectedFiles.length > 0 
              ? 'bg-primary text-white' 
              : 'bg-white/10 text-gray-500'
          }`}
        >
          Next
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <ImageIcon className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-lg mb-2">No media selected</p>
            <p className="text-sm mb-6">Choose photos or videos to start creating</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
            >
              Browse Gallery
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {selectedFiles.map((item, index) => (
              <div key={item.id} className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden group">
                {item.file.type.startsWith('video/') ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url} alt="media" className="w-full h-full object-cover" />
                )}
                
                <div className="absolute top-2 left-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold border border-white/20 shadow-md">
                  {index + 1}
                </div>

                <button 
                  onClick={() => removeFile(item.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-md opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {selectedFiles.length < 10 && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[9/16] bg-white/5 hover:bg-white/10 rounded-lg flex flex-col items-center justify-center text-gray-400 border border-white/10 border-dashed transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-2">
                  <span className="text-2xl font-light">+</span>
                </div>
                <span className="text-xs">Add more</span>
              </button>
            )}
          </div>
        )}
      </div>

      <input 
        type="file" 
        multiple
        accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden" 
      />
    </motion.div>
  );
};

export default MediaPicker;
