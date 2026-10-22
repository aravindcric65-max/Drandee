require("dotenv").config();

const ImageKit = require("imagekit");

// ============================================
// Environment Variables
// ============================================
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

// ============================================
// Validation
// ============================================

// Check if credentials are missing
const missingCredentials = [];

if (!publicKey) {
  missingCredentials.push("IMAGEKIT_PUBLIC_KEY");
}

if (!privateKey) {
  missingCredentials.push("IMAGEKIT_PRIVATE_KEY");
}

if (!urlEndpoint) {
  missingCredentials.push("IMAGEKIT_URL_ENDPOINT");
}

// Warn if credentials are missing
if (missingCredentials.length > 0) {
  console.warn(
    "⚠️  ImageKit credentials missing!",
    `\nPlease set the following environment variables in .env file:`,
    `\n  ${missingCredentials.join("\n  ")}`,
    `\n\nGet your credentials from: https://imagekit.io`
  );
}

// Validate endpoint URL format
if (urlEndpoint && !urlEndpoint.startsWith("https://")) {
  console.warn(
    "⚠️  ImageKit URL_ENDPOINT should start with 'https://'",
    `\nCurrent value: ${urlEndpoint}`,
    `\nExpected format: https://ik.imagekit.io/your_imagekit_id/`
  );
}

// ============================================
// ImageKit Initialization
// ============================================

const imagekit = new ImageKit({
  publicKey: publicKey || "",
  privateKey: privateKey || "",
  urlEndpoint: urlEndpoint || "",
});

// ============================================
// Test Connection (Optional)
// ============================================

// Test ImageKit connection on startup
const testConnection = async () => {
  if (!publicKey || !privateKey || !urlEndpoint) {
    console.log("❌ ImageKit: Skipping connection test (credentials missing)");
    return false;
  }

  try {
    // Try to get file list (simple API call)
    await imagekit.listFiles({ limit: 1 });
    console.log("✅ ImageKit: Connection successful");
    return true;
  } catch (error) {
    console.error("❌ ImageKit: Connection failed", {
      message: error.message,
      code: error.code,
    });
    return false;
  }
};

// Run connection test (non-blocking)
if (process.env.NODE_ENV !== "test") {
  testConnection().catch(console.error);
}

// ============================================
// Helper Functions
// ============================================

// Get upload parameters for frontend
const getUploadParameters = (options = {}) => {
  const {
    fileName = "upload",
    folder = "/uploads",
    useUniqueFileName = true,
    tags = [],
    customCoordinates = null,
    responseTransformation = null,
  } = options;

  return imagekit.getUploadParameters({
    upload: {
      fileName,
      folder,
      useUniqueFileName,
      tags,
      customCoordinates,
      responseTransformation,
    },
  });
};

// Get authentication parameters for frontend
const getAuthenticationParameters = (options = {}) => {
  const {
    path = "/",
    expiryInSeconds = 3600,
  } = options;

  return imagekit.getAuthenticationParameters(path, expiryInSeconds);
};

// ============================================
// Export
// ============================================

module.exports = imagekit;
module.exports.getUploadParameters = getUploadParameters;
module.exports.getAuthenticationParameters = getAuthenticationParameters;
module.exports.testConnection = testConnection;