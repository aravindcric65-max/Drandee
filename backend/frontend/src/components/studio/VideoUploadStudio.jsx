import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUpload } from '../../context/UploadContext';
import Camera from './Camera';
import MediaPicker from './MediaPicker';
import MediaPreview from './MediaPreview';
import VideoEditor from './VideoEditor';
import PrivacyPanel from './PrivacyPanel';
import UploadProgress from './UploadProgress';
import UploadSuccess from './UploadSuccess';
import { saveDraft, loadDraft, clearDraft } from '../../utils/draftStorage';

const VideoUploadStudio = ({ initialStep = 'gallery', onClose }) => {
  const { startUpload } = useUpload();
  const [currentStep, setCurrentStep] = useState(initialStep); // 'camera', 'gallery', 'preview', 'editor', 'publish', 'uploading', 'success'
  const [mediaItems, setMediaItems] = useState([]);
  const [settings, setSettings] = useState({
    caption: '',
    hashtags: [],
    privacy: 'public',
    allowComments: true,
    allowSharing: true,
    allowDuet: true,
    sound: null,
    cover: null,
    aspectRatio: '9:16',
    edits: {
      filter: 'Original',
      effects: 'None',
      adjustments: { brightness: 100, contrast: 100, saturation: 100, exposure: 100, temperature: 0, highlights: 0, shadows: 0, sharpness: 0 },
      crop: null,
      text: []
    }
  });

  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState(null);

  // Check for draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      const draft = await loadDraft();
      if (draft) {
        setDraftData(draft);
        setShowDraftPrompt(true);
      }
    };
    checkDraft();
  }, []);

  const handleKeepEditing = () => {
    setMediaItems(draftData.mediaItems);
    setSettings(draftData.settings);
    setCurrentStep('editor');
    setShowDraftPrompt(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftPrompt(false);
  };

  // Save draft when media or settings change
  useEffect(() => {
    if (mediaItems.length > 0 && currentStep !== 'success' && currentStep !== 'uploading') {
      saveDraft(mediaItems, settings);
    }
  }, [mediaItems, settings, currentStep]);

  const [uploadState, setUploadState] = useState({
    progress: 0,
    stage: 'preparing',
    error: null,
    isPaused: false
  });

  const handleMediaSelected = (items) => {
    setMediaItems(items);
    setCurrentStep('preview');
  };

  const handleCameraRecord = (file) => {
    const item = {
      file,
      url: URL.createObjectURL(file),
      id: Math.random().toString(36).substring(7)
    };
    setMediaItems([item]);
    setCurrentStep('preview');
  };

  const handleNextToEditor = () => {
    setCurrentStep('editor');
  };

  const handlePublishClick = (finalSettings) => {
    setSettings(prev => ({ ...prev, ...finalSettings }));
    setCurrentStep('publish');
  };

  const handleConfirmPublish = async () => {
    try {
      const token = localStorage.getItem('token');
      const file = mediaItems[0]?.file;
      
      let postType = 'video';
      if (file.type && file.type.startsWith('image/')) {
        postType = 'photo';
      }
      
      // Start background upload via context (will show toast)
      startUpload(file, settings, token, postType);
      
      clearDraft();
      handleClose(); // Instantly close the studio and return to feed
    } catch (err) {
      console.error('Upload Error:', err);
      alert('Failed to start upload: ' + err.message);
    }
  };

  const cleanup = useCallback(() => {
    mediaItems.forEach(item => URL.revokeObjectURL(item.url));
  }, [mediaItems]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleClose = () => {
    cleanup();
    if (onClose) onClose();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'camera':
        return (
          <Camera 
            onClose={handleClose}
            onRecordComplete={handleCameraRecord}
            onGalleryClick={() => setCurrentStep('gallery')}
          />
        );
      case 'gallery':
        return (
          <MediaPicker 
            onCancel={handleClose}
            onMediaSelect={handleMediaSelected}
          />
        );
      case 'preview':
        return (
          <MediaPreview 
            mediaItems={mediaItems}
            onCancel={() => setCurrentStep(initialStep)}
            onNext={handleNextToEditor}
          />
        );
      case 'editor':
        return (
          <VideoEditor 
            mediaItems={mediaItems}
            initialSettings={settings}
            onBack={() => setCurrentStep('preview')}
            onNext={handlePublishClick}
          />
        );
      case 'publish':
        return (
          <PrivacyPanel 
            initialSettings={settings}
            onBack={() => setCurrentStep('editor')}
            onClose={handleClose}
            onSave={(newSettings) => setSettings(prev => ({ ...prev, ...newSettings }))}
            onNext={handleConfirmPublish}
          />
        );
      case 'uploading':
        return (
          <UploadProgress
            fileName={mediaItems[0]?.file?.name || 'video.mp4'}
            fileSize={100}
            totalSize={100}
            uploadSpeed="5.2"
            stage={uploadState.stage}
            progress={uploadState.progress}
            isPaused={uploadState.isPaused}
            error={uploadState.error}
            onCancel={handleClose}
            onPause={() => setUploadState(prev => ({ ...prev, isPaused: true }))}
            onResume={() => setUploadState(prev => ({ ...prev, isPaused: false }))}
            onRetry={handleConfirmPublish}
          />
        );
      case 'success':
        return (
          <UploadSuccess
            videoUrl={mediaItems[0]?.url}
            videoTitle={settings.caption || 'New Post'}
            onViewPost={handleClose} // Should navigate to post
            onDone={handleClose}
            onShare={() => alert('Sharing...')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0a0a0f] z-[9999] pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* Draft Recovery Modal */}
      {showDraftPrompt && (
        <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-[#1a1a24] rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white mb-2">Unsaved Draft Found</h3>
            <p className="text-white/70 text-sm mb-6">You have an unfinished post. Would you like to continue editing where you left off?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleKeepEditing}
                className="w-full py-3 bg-[#6366F1] text-white font-semibold rounded-xl hover:bg-[#4F46E5] transition-colors"
              >
                Keep Editing
              </button>
              <button 
                onClick={handleDiscardDraft}
                className="w-full py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors"
              >
                Discard & Start New
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default VideoUploadStudio;