/**
 * Audit middleware for logging privacy changes
 * Creates audit log entries for all privacy API calls
 */

const { pool } = require("../config/database");

/**
 * Creates audit middleware for privacy API changes
 * @param {string} action - The action being audited (e.g., 'privacy_update')
 * @returns {Function} Express middleware function
 */
const createPrivacyAudit = (action) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    const originalJson = res.json;
    
    // Override res.json to capture response
    res.json = function(data) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Only log successful updates
      if (data && data.success === true) {
        const postId = req.params.id;
        const userId = req.auth?.userId;
        
        // Extract privacy changes from request body
        const privacyChanges = {};
        if (req.body) {
          if (typeof req.body.hideRespectCount === 'boolean') {
            privacyChanges.hideRespectCount = req.body.hideRespectCount;
          }
          if (typeof req.body.hideShareCount === 'boolean') {
            privacyChanges.hideShareCount = req.body.hideShareCount;
          }
          if (typeof req.body.commentsEnabled === 'boolean') {
            privacyChanges.commentsEnabled = req.body.commentsEnabled;
          }
          if (typeof req.body.reuseEnabled === 'boolean') {
            privacyChanges.reuseEnabled = req.body.reuseEnabled;
          }
        }
        
        // Log to database asynchronously (don't block response)
        logAuditEntry({
          action,
          userId,
          postId,
          privacyChanges,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          requestId: req.requestId,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }).catch(err => {
          console.error('Failed to log audit entry:', err.message);
        });
      }
      
      // Call original res.json
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Logs an audit entry to the database
 */
async function logAuditEntry(auditData) {
  try {
    // Check if audit_logs table exists, create if not
    await ensureAuditTable();
    
    const {
      action,
      userId,
      postId,
      privacyChanges = {},
      method,
      path,
      statusCode,
      duration,
      requestId,
      userAgent,
      ip
    } = auditData;
    
    await pool.query(
      `INSERT INTO audit_logs (
        action,
        user_id,
        post_id,
        privacy_changes,
        method,
        path,
        status_code,
        duration_ms,
        request_id,
        user_agent,
        ip_address,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
      [
        action,
        userId,
        postId,
        JSON.stringify(privacyChanges),
        method,
        path,
        statusCode,
        duration,
        requestId,
        userAgent,
        ip
      ]
    );
  } catch (error) {
    console.error('Audit logging error:', error.message);
    // Don't throw - auditing failures shouldn't break the API
  }
}

/**
 * Ensures audit_logs table exists
 */
async function ensureAuditTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        privacy_changes JSONB,
        method VARCHAR(10),
        path VARCHAR(500),
        status_code INTEGER,
        duration_ms INTEGER,
        request_id VARCHAR(100),
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Create indexes separately — INDEX syntax is not valid inside CREATE TABLE in PostgreSQL
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_post_id_idx ON audit_logs (post_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC)`);
  } catch (error) {
    console.error('Failed to ensure audit_logs table:', error.message);
  }
}

module.exports = {
  createPrivacyAudit,
  logAuditEntry
};