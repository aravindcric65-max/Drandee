import axios from "axios";

// ============================================
// Configuration
// ============================================
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

// ImageKit Configuration
const IMAGEKIT_CONFIG = {
  uploadEndpoint: "/api/upload", // Proxy to backend
};

// ============================================
// Utility Functions
// ============================================

// Convert file to base64
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(new Error("File read error"));
  });

// Validate file before upload
const validateFile = (file) => {
  if (!file) {
    throw new Error("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Allowed: images and videos");
  }

  return true;
};

// Calculate upload speed and ETA
const calculateUploadStats = (loaded, total, startTime) => {
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = elapsed > 0 ? loaded / elapsed : 0;
  const remaining = total - loaded;
  const eta = speed > 0 ? remaining / speed : 0;

  return {
    speed,
    eta,
    percentCompleted: Math.round((loaded * 100) / total),
  };
};

// ============================================
// Main Upload Function
// ============================================

export const uploadToImageKit = async (file, onProgress = null) => {
  const startTime = Date.now();

  try {
    validateFile(file);
    const base64 = await toBase64(file);

    const response = await axios.post(
      IMAGEKIT_CONFIG.uploadEndpoint,
      {
        file: base64,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const { loaded, total } = progressEvent;
            const { percentCompleted, speed, eta } = calculateUploadStats(
              loaded,
              total,
              startTime
            );

            onProgress({
              progress: percentCompleted,
              speed,
              eta,
              loaded,
              total,
            });
          }
        },
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || "Upload failed");
    }

    return {
      url: response.data.url || response.data.fileUrl,
      fileId: response.data.fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    };
  } catch (error) {
    console.error("ImageKit upload error:", {
      message: error.message,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    throw new Error(error.message || "Upload failed");
  }
};

// ============================================
// Configuration Export
// ============================================

export const uploadConfig = {
  maxFileSize: MAX_FILE_SIZE,
  allowedTypes: ALLOWED_TYPES,
  imageKit: IMAGEKIT_CONFIG,
};

export default uploadToImageKit;