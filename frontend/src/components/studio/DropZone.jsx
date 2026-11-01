import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, FileVideo } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const DropZone = ({ onFileSelect, onBack }) => {
  const [selectedFile, setSelectedFile] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.webm', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#090A0F] p-6">
      <div className="flex items-center gap-4 mb-8">
        <motion.button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-[#151820]"
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-6 h-6 text-white" />
        </motion.button>
        <h1 className="text-white font-bold text-xl">Select Video</h1>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-[#6366F1] bg-[#6366F1]/10' 
            : 'border-white/10 hover:border-[#6366F1]/50'}`}
      >
        <input {...getInputProps()} />

        <motion.div
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#6366F1]/20 to-[#A855F7]/20 flex items-center justify-center"
          animate={{ scale: isDragActive ? 1.1 : 1 }}
        >
          <Upload className="w-10 h-10 text-[#6366F1]" />
        </motion.div>

        <h3 className="text-white font-semibold text-xl mb-2">
          {isDragActive ? 'Drop your video here' : 'Drag & drop your video'}
        </h3>
        
        <p className="text-white/70 mb-6">
          or click to browse from your device
        </p>

        <motion.button
          className="px-8 py-4 bg-gradient-to-r from-[#6366F1] to-[#A855F7] rounded-2xl text-white font-semibold"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Browse Files
        </motion.button>

        <p className="text-white/50 text-sm mt-6">
          Supports: MP4, MOV, WebM, AVI • Max 100MB
        </p>
      </div>

      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 bg-[#151820] rounded-2xl"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#6366F1]/20 flex items-center justify-center">
              <FileVideo className="w-8 h-8 text-[#6366F1]" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-semibold truncate">
                {selectedFile.name}
              </h4>
              <p className="text-white/70 text-sm">
                {formatBytes(selectedFile.size)}
              </p>
            </div>
            <div className="px-4 py-2 bg-green-500/20 rounded-xl">
              <span className="text-green-500 text-sm font-medium">Ready</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DropZone;