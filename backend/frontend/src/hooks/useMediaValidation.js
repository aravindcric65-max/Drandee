import { useCallback } from 'react';

const useMediaValidation = () => {
  const validateVideoFile = useCallback((file) => {
    const errors = [];

    if (!file) {
      errors.push('No file selected');
      return { valid: false, errors };
    }

    // Check file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      errors.push('Invalid file type. Please upload MP4, MOV, or WebM.');
    }

    // Check file size (500 MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push('File size exceeds 500 MB limit.');
    }

    // Check file size (1 MB min)
    const minSize = 1 * 1024 * 1024;
    if (file.size < minSize) {
      errors.push('File size must be at least 1 MB.');
    }

    return {
      valid: errors.length === 0,
      errors,
      file,
    };
  }, []);

  const validateMetadata = useCallback((metadata) => {
    const errors = [];

    if (!metadata.caption || metadata.caption.trim().length === 0) {
      errors.push('Caption is required');
    }

    if (metadata.caption && metadata.caption.length > 150) {
      errors.push('Caption must be less than 150 characters');
    }

    if (!metadata.privacy || !['public', 'friends', 'private'].includes(metadata.privacy)) {
      errors.push('Invalid privacy setting');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }, []);

  return {
    validateVideoFile,
    validateMetadata,
  };
};

export default useMediaValidation;