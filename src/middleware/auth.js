const jwt = require("jsonwebtoken");
const firebaseConfig = require("../config/firebase");
const redisManager = require("../config/redis");
const { User, CA, Admin } = require("../../models");
const logger = require("../config/logger");
const CONSTANTS = require("../config/constants");

// Initialize Firebase
firebaseConfig.initialize();

/**
 * Middleware to verify Firebase ID token and JWT token
 * Supports both Firebase Auth and custom JWT authentication
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
          message: "Access token required",
        },
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Try Firebase token verification first
    const firebaseResult = await firebaseConfig.verifyIdToken(token);

    if (firebaseResult.success) {
      // Firebase token is valid
      const { uid, email, email_verified } = firebaseResult.data;

      // Check if user exists in our database - be explicit about type
      let user = await User.findOne({ where: { googleUid: uid } });
      let userType = "user";

      if (!user) {
        // Check if it's a CA - but only if they have a pre-existing CA record
        user = await CA.findOne({ where: { googleUid: uid } });
        if (user) {
          userType = "ca";
          // Additional security: verify CA is actually verified/active
          if (user.status && user.status !== "active") {
            return res.status(401).json({
              success: false,
              error: {
                code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
                message: "CA account pending verification or inactive",
              },
            });
          }
        } else {
          // Check if it's an admin
          user = await Admin.findOne({ where: { googleUid: uid } });
          if (user) {
            userType = "admin";
            // Additional security: verify admin is active
            if (user.status && user.status !== "active") {
              return res.status(401).json({
                success: false,
                error: {
                  code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
                  message: "Admin account is inactive",
                },
              });
            }
          }
        }
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.USER_NOT_FOUND,
            message: "Account not found in system. Please contact support.",
          },
        });
      }

      // Attach user info to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        type: userType,
        firebaseUid: uid,
        emailVerified: true,
      };

      // Cache user session
      await redisManager.setSession(`firebase_${uid}`, req.user, 24 * 60 * 60);

      return next();
    }

    // If Firebase verification failed, try JWT verification
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if session exists in Redis
      let sessionData = null;
      if (redisManager.client && redisManager.client.isReady) {
        sessionData = await redisManager.getSession(decoded.sessionId);
      } else {
        logger.warn("Redis unavailable for session check, allowing auth with JWT only");
      }

      if (!sessionData) {
        return res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTH_TOKEN_EXPIRED,
            message: "Session expired",
          },
        });
      }

      // Verify user still exists
      let user;
      if (decoded.userType === "ca") {
        user = await CA.findByPk(decoded.userId);
      } else {
        user = await User.findByPk(decoded.userId);
      }

      if (!user) {
        await redisManager.deleteSession(decoded.sessionId);
        return res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.USER_NOT_FOUND,
            message: "User not found",
          },
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        type: decoded.userType,
        sessionId: decoded.sessionId,
      };

      return next();
    } catch (jwtError) {
      logger.error("JWT verification failed:", jwtError);
      return res.status(401).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTH_TOKEN_INVALID,
          message: "Invalid access token",
        },
      });
    }
  } catch (error) {
    logger.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: CONSTANTS.ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: "Authentication service error",
      },
    });
  }
};

/**
 * Middleware to check if user has required role
 * @param {string|string[]} roles - Required role(s)
 */
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
          message: "Authentication required",
        },
      });
    }

    if (!allowedRoles.includes(req.user.type)) {
      return res.status(403).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTH_FORBIDDEN,
          message: "Insufficient permissions",
        },
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
        message: "Authentication required",
      },
    });
  }

  // Check if user is admin using proper Admin model
  if (req.user.type !== "admin") {
    return res.status(403).json({
      success: false,
      error: {
        code: CONSTANTS.ERROR_CODES.AUTH_FORBIDDEN,
        message: "Admin access required",
      },
    });
  }

  next();
};

/**
 * Middleware to check if admin has specific permission
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user || req.user.type !== "admin") {
      return res.status(401).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
          message: "Admin authentication required",
        },
      });
    }

    try {
      // Get full admin details with permissions
      const admin = await Admin.findByPk(req.user.id);

      if (!admin || admin.status !== "active") {
        return res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
            message: "Admin account inactive",
          },
        });
      }

      // Check if admin has the required permission
      const hasPermission =
        admin.permissions?.[permission] === true ||
        admin.role === "super_admin";

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTH_FORBIDDEN,
            message: `Missing permission: ${permission}`,
          },
        });
      }

      // Attach full admin data to request
      req.admin = admin;
      next();
    } catch (error) {
      logger.error("Permission check error:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: "Permission check failed",
        },
      });
    }
  };
};

/**
 * Middleware to verify user owns the resource
 * @param {string} paramName - Parameter name in req.params containing user ID
 */
const requireOwnership = (paramName = "userId") => {
  return (req, res, next) => {
    const resourceUserId = req.params[paramName];

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTH_UNAUTHORIZED,
          message: "Authentication required",
        },
      });
    }

    if (req.user.id !== resourceUserId) {
      return res.status(403).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTH_FORBIDDEN,
          message: "Access denied to this resource",
        },
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(); // No token provided, continue without authentication
  }

  // Use the same logic as authenticateToken but don't return errors
  try {
    const token = authHeader.substring(7);

    // Try Firebase first
    const firebaseResult = await firebaseConfig.verifyIdToken(token);

    if (firebaseResult.success) {
      const { uid } = firebaseResult.data;
      let user = await User.findOne({ where: { googleUid: uid } });
      let userType = "user";

      if (!user) {
        user = await CA.findOne({ where: { googleUid: uid } });
        if (user) {
          userType = "ca";
          // Only allow verified CAs in optional auth
          if (!user.verified || (user.status && user.status === "suspended")) {
            user = null; // Don't authenticate unverified/suspended CAs
          }
        }
      }

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          type: userType,
          firebaseUid: uid,
        };
      }
    } else {
      // Try JWT
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const sessionData = await redisManager.getSession(decoded.sessionId);

        if (sessionData) {
          req.user = sessionData;
        }
      } catch (jwtError) {
        // Ignore JWT errors in optional auth
      }
    }
  } catch (error) {
    logger.error("Optional auth error:", error);
    // Continue without authentication on error
  }

  next();
};

/**
 * Middleware to refresh JWT token if it's about to expire
 */
const refreshTokenIfNeeded = async (req, res, next) => {
  if (!req.user || !req.user.sessionId) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });

    // Check if token expires in the next 30 minutes
    const expirationTime = decoded.exp * 1000;
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    if (expirationTime - now < thirtyMinutes) {
      // Generate new token
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newToken = jwt.sign(
        {
          userId: req.user.id,
          userType: req.user.type,
          sessionId,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // Update session in Redis
      await redisManager.setSession(sessionId, req.user);
      await redisManager.deleteSession(req.user.sessionId);

      // Send new token in response header
      res.setHeader("X-New-Token", newToken);
      req.user.sessionId = sessionId;
    }
  } catch (error) {
    logger.error("Token refresh error:", error);
    // Continue without refreshing on error
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requirePermission,
  requireOwnership,
  optionalAuth,
  refreshTokenIfNeeded,
};
