/**
 * Central Authorization Middleware
 * Verifies that the authenticated user possesses one of the allowed roles.
 * Must be used AFTER authMiddleware.
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Ensure authentication context exists
    if (!req.auth || !req.auth.role) {
      return res.status(403).json({
        success: false,
        error: "You're not allowed to perform this action.",
      });
    }

    // Role-based Access Control (RBAC) check
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        error: "You're not allowed to perform this action.",
      });
    }

    next();
  };
};

module.exports = requireRole;
