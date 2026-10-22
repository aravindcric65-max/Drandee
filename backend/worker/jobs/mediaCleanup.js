const { pool } = require('../../config/database');
const ImageKit = require('imagekit');
const fs = require('fs');
const path = require('path');

let imagekit = null;
if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
}

/**
 * Job data expects:
 * - mediaId: Canonical ID from `media` table (already deleted from DB)
 * - storage_provider: 'imagekit' or 'local'
 * - provider_file_id: ImageKit file ID
 * - url: File URL
 */
module.exports = async function mediaCleanup(jobData) {
  const { mediaId, storage_provider, provider_file_id, url } = jobData;
  if (!mediaId) throw new Error("mediaId is required for cleanup job");

  // Determine storage type and delete physical file
  if (storage_provider === 'imagekit' && imagekit && provider_file_id) {
    try {
      await new Promise((resolve, reject) => {
        imagekit.deleteFile(provider_file_id, (error, result) => {
          if (error) {
            if (error.message && error.message.includes("does not exist")) resolve();
            else reject(error);
          }
          else resolve(result);
        });
      });
      console.log(`[MediaCleanup] Deleted from ImageKit: ${provider_file_id}`);
    } catch (err) {
      console.error(`[MediaCleanup] Failed to delete from ImageKit:`, err);
      throw err; // Trigger BullMQ retry
    }
  } else if (storage_provider === 'local' && url) {
    // Local file
    try {
      const filename = url.split('/').pop();
      if (filename) {
        const filepath = path.join(__dirname, '../../uploads', filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log(`[MediaCleanup] Deleted local file: ${filepath}`);
        }
      }
    } catch (err) {
      console.error(`[MediaCleanup] Failed to delete local file:`, err);
      // Do not throw for local file missing
    }
  }
};
