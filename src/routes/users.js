const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const consultationController = require("../controllers/consultationController");
const documentController = require("../controllers/documentController");
const { authenticateToken } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Apply middleware to all routes
router.use(authenticateToken);
router.use(securityHeaders);
router.use(sanitizeInput);

// User profile routes
router.get("/:userId", rateLimit.apiRateLimit, userController.getUserProfile);
router.put(
  "/:userId",
  rateLimit.apiRateLimit,
  userController.updateUserProfile
);

// User data routes
router.get(
  "/:userId/consultations",
  rateLimit.apiRateLimit,
  userController.getUserConsultations
);
router.get(
  "/:userId/filings",
  rateLimit.apiRateLimit,
  userController.getUserFilings
);
router.get(
  "/:userId/payments",
  rateLimit.apiRateLimit,
  userController.getUserPayments
);
router.get(
  "/:userId/documents",
  rateLimit.apiRateLimit,
  documentController.getUserDocuments
);
router.get(
  "/:userId/dashboard",
  rateLimit.apiRateLimit,
  userController.getUserDashboard
);

// Consultation booking
router.post(
  "/consultations",
  rateLimit.apiRateLimit,
  consultationController.bookConsultation
);

// Cache management (admin only)
router.delete(
  "/:userId/cache",
  rateLimit.strictRateLimit,
  userController.clearUserCache
);

module.exports = router;
