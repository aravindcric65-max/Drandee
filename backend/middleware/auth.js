const { getAuth } = require('../config/firebase');
const { pool } = require('../config/database');

const authMiddleware = async (req, res, next) => {
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

  // BLOCK 1: Token verification (strictly catches invalid/expired/revoked tokens)
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
  } catch (error) {
    console.error("Auth verification failed (safe log)", {
      code: error?.code || error?.errorInfo?.code || 'no-code',
      type: error?.constructor?.name || 'unknown',
    });
    return res.status(401).json({
      success: false,
      error: "Authentication invalid or expired",
    });
  }

  // Extract verified Firebase UID
  const firebaseUid = decodedToken.uid;

  // BLOCK 2: Database user lookup (Zero-Trust Identity) — database errors return 500, not 401
  let userResult;
  try {
    userResult = await pool.query(
      "SELECT id, role, account_status FROM users WHERE firebase_uid = $1 LIMIT 1",
      [firebaseUid]
    );
  } catch (dbError) {
    console.error("Auth database lookup failed (safe log)", {
      code: dbError?.code || 'db-error',
      type: dbError?.constructor?.name || 'unknown',
    });
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }

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

  // Verify Account Status
  const status = user.account_status;
  if (status === 'DEACTIVATED' || status === 'DELETED' || status === 'SUSPENDED') {
    return res.status(403).json({
      success: false,
      error: "Account is not active",
    });
  }

  // Attach trusted authentication context
  req.auth = {
    firebaseUid: firebaseUid,
    userId: user.id,
    role: user.role,
    accountStatus: status
  };

  // Legacy backwards compatibility: Some controllers might still expect req.user
  req.user = user;

  next();
};

module.exports = authMiddleware;
