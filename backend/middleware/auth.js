const { getAuth } = require('../config/firebase');
const { pool } = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication token missing",
      });
    }

    // 1. Verify Firebase token
    // This strictly throws if invalid, expired, or revoked
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // 2. Extract verified Firebase UID
    const firebaseUid = decodedToken.uid;
    
    // 3. Lookup user in Neon DB by firebase_uid EXCLUSIVELY (Zero-Trust Identity)
    const userResult = await pool.query(
      "SELECT id, role, account_status FROM users WHERE firebase_uid = $1 LIMIT 1",
      [firebaseUid]
    );
    
    if (userResult.rows.length === 0) {
      // Valid Firebase user, but no Drandee account exists yet.
      // This is expected during the first step of registration.
      // We will attach the firebaseUid so provisioning routes can use it.
      req.auth = {
        firebaseUid: firebaseUid,
        userId: null,
        role: null,
        accountStatus: null
      };
      return next();
    }

    const user = userResult.rows[0];

    // 4. Verify Account Status
    const status = user.account_status;
    if (status === 'DEACTIVATED' || status === 'DELETED' || status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: "Account is not active",
      });
    }

    // 5. Attach trusted authentication context
    req.auth = {
      firebaseUid: firebaseUid,
      userId: user.id,
      role: user.role,
      accountStatus: status
    };

    // Legacy backwards compatibility: Some controllers might still expect req.user
    // But we will transition to strictly req.auth
    req.user = user;

    next();
  } catch (error) {
    // 6. Safe Error Handling
    // Do NOT leak Firebase internal errors, stack traces, or token contents
    // DIAG: log only safe error code/type, never the token
    console.error("Auth verification failed (safe log)", {
      code: error?.code || error?.errorInfo?.code || 'no-code',
      type: error?.constructor?.name || 'unknown',
    });
    return res.status(401).json({
      success: false,
      error: "Authentication invalid or expired",
    });
  }
};

module.exports = authMiddleware;