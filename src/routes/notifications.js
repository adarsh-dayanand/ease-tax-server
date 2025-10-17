const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { authenticateToken } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Apply middleware to all routes
router.use(authenticateToken);
router.use(securityHeaders);
router.use(sanitizeInput);

// Notification routes
router.get(
  "/",
  rateLimit.apiRateLimit,
  notificationController.getNotifications
);
router.post(
  "/mark-read",
  rateLimit.apiRateLimit,
  notificationController.markAsRead
);
router.post(
  "/mark-all-read",
  rateLimit.apiRateLimit,
  notificationController.markAllAsRead
);

// Admin routes
router.post(
  "/send-bulk",
  rateLimit.strictRateLimit,
  notificationController.sendBulkNotification
);

module.exports = router;
