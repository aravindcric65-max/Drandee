import { useState, useCallback } from 'react';
import { parseApiResponse } from '../utils/apiHelper';

const useVideoUpload = () => {
  const [uploadState, setUploadState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadSpeed, setUploadSpeed] = useState(null);
  const [mediaId, setMediaId] = useState(null);

  const uploadVideo = useCallback(async (file, metadata) => {
    try {
      setUploadState('validating');
      setError(null);

      // Validate file
      if (!file || !file.type.startsWith('video/')) {
        throw new Error('Invalid file type. Please upload a video file.');
      }

      const maxSize = 500 * 1024 * 1024; // 500 MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 500 MB limit.');
      }

      setUploadState('requesting_signature');

      // Get upload signature from backend
      const signatureResponse = await fetch('/api/media/upload-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      });

      const { signature, uploadParams } = await parseApiResponse(signatureResponse, "Upload Signature");

      setUploadState('uploading');
      setProgress(0);

      // Upload to ImageKit
      const formData = new FormData();
      formData.append('file', file);
      formData.append('publicId', uploadParams.publicId);
      formData.append('signature', signature);
      formData.append('expire', uploadParams.expire);

      const uploadResponse = await fetch(`https://upload.imagekit.io/api/v1/files/upload`, {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await parseApiResponse(uploadResponse, "ImageKit Upload");
      setMediaId(uploadResult.fileId);
      setUploadState('uploaded');
      setProgress(100);

      // Save metadata to backend
      setUploadState('processing');
      const metadataResponse = await fetch('/api/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          mediaId: uploadResult.fileId,
          videoUrl: uploadResult.url,
          ...metadata,
        }),
      });

      await parseApiResponse(metadataResponse, "Save Metadata");

      setUploadState('completed');
      return { success: true, mediaId: uploadResult.fileId, url: uploadResult.url };

    } catch (err) {
      setUploadState('failed');
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const cancelUpload = useCallback(() => {
    setUploadState('cancelled');
    setProgress(0);
  }, []);

  const pauseUpload = useCallback(() => {
    // TODO: Implement pause functionality
  }, []);

  const resumeUpload = useCallback(() => {
    // TODO: Implement resume functionality
  }, []);

  const resetUpload = useCallback(() => {
    setUploadState('idle');
    setProgress(0);
    setError(null);
    setUploadSpeed(null);
    setMediaId(null);
  }, []);

  return {
    uploadState,
    progress,
    error,
    uploadSpeed,
    mediaId,
    uploadVideo,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    resetUpload,
  };
};

export default useVideoUpload;