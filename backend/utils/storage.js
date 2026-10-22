const fs = require('fs/promises');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../private_exports');

// Ensure directory exists on startup
fs.mkdir(STORAGE_DIR, { recursive: true }).catch(console.error);

class StorageAbstraction {
  /**
   * Save content to private storage.
   * @param {string} key - Unique key/filename for the item (e.g. jobId.json)
   * @param {string|Buffer} content - The file content
   */
  static async save(key, content) {
    // Prevent path traversal
    const safeKey = path.basename(key);
    const filePath = path.join(STORAGE_DIR, safeKey);
    await fs.writeFile(filePath, content);
    return true;
  }

  /**
   * Read content from private storage as a Buffer.
   * @param {string} key
   */
  static async read(key) {
    const safeKey = path.basename(key);
    const filePath = path.join(STORAGE_DIR, safeKey);
    return fs.readFile(filePath);
  }

  /**
   * Check if a file exists.
   * @param {string} key 
   */
  static async exists(key) {
    const safeKey = path.basename(key);
    const filePath = path.join(STORAGE_DIR, safeKey);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file from private storage.
   * @param {string} key 
   */
  static async delete(key) {
    const safeKey = path.basename(key);
    const filePath = path.join(STORAGE_DIR, safeKey);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return true; // Already deleted
      throw err;
    }
  }

  /**
   * Get an absolute local path (only for internal streaming, never returned to client).
   * @param {string} key 
   */
  static _getLocalPath(key) {
    const safeKey = path.basename(key);
    return path.join(STORAGE_DIR, safeKey);
  }
}

module.exports = StorageAbstraction;
