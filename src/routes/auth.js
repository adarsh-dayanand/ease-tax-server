const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const caAuthController = require("../controllers/caAuthController");
const adminAuthController = require("../controllers/adminAuthController");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const firebaseConfig = require("../config/firebase");

// Firebase configuration check endpoint (development only)
if (process.env.NODE_ENV === "development") {
  router.get("/firebase-status", (req, res) => {
    const requiredVars = [
      "FIREBASE_PROJECT_ID",
      "FIREBASE_PRIVATE_KEY",
      "FIREBASE_CLIENT_EMAIL",
    ];

    const envStatus = {};
    requiredVars.forEach((varName) => {
      envStatus[varName] = process.env[varName] ? "SET" : "MISSING";
    });

    res.json({
      success: true,
      data: {
        firebaseConfigured: firebaseConfig.initialized,
        environmentVariables: envStatus,
        nodeEnv: process.env.NODE_ENV,
      },
    });
  });
}

// User Google Auth endpoints
router.post(
  "/user/google",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  authController.googleLoginOrRegister
);

// User Phone Auth endpoints
router.post(
  "/user/phone",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  authController.phoneLoginOrRegister
);

// CA Auth endpoints
router.post(
  "/ca/google",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  caAuthController.googleLoginOrRegister
);

router.post(
  "/ca/phone",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  caAuthController.phoneLogin
);

// CA Registration Request (public endpoint - no auth required)
router.post(
  "/ca/request-registration",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  caAuthController.requestCARegistration
);

// Admin Auth endpoints
router.post(
  "/admin/google",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  adminAuthController.adminGoogleLogin
);

// Create first super admin (development only)
router.post(
  "/admin/create-super-admin",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  adminAuthController.createSuperAdmin
);

// Refresh Firebase ID token
router.post(
  "/refresh-firebase-token",
  rateLimit.authRateLimit,
  securityHeaders,
  sanitizeInput,
  authController.refreshFirebaseToken
);

// Get admin profile
router.get("/profile", authenticateToken, authController.getProfileByIdToken);

module.exports = router;
