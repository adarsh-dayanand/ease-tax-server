const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticateToken } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Public routes
router.get(
  "/methods",
  rateLimit.apiRateLimit,
  securityHeaders,
  paymentController.getPaymentMethods
);

// Webhook route (no authentication required)
router.post(
  "/webhook",
  rateLimit.strictRateLimit,
  securityHeaders,
  paymentController.handleWebhook
);

// Apply authentication to remaining routes
router.use(authenticateToken);
router.use(securityHeaders);
router.use(sanitizeInput);

// Payment operations
router.post(
  "/initiate",
  rateLimit.strictRateLimit,
  paymentController.initiatePayment
);
router.get(
  "/:paymentId/status",
  rateLimit.apiRateLimit,
  paymentController.getPaymentStatus
);
router.post(
  "/:paymentId/verify",
  rateLimit.strictRateLimit,
  paymentController.verifyPayment
);
router.get(
  "/history",
  rateLimit.apiRateLimit,
  paymentController.getPaymentHistory
);
router.post(
  "/refund",
  rateLimit.strictRateLimit,
  paymentController.requestRefund
);

// Development/testing routes
if (process.env.NODE_ENV === "development") {
  router.post(
    "/:paymentId/mock-success",
    rateLimit.apiRateLimit,
    paymentController.mockPaymentSuccess
  );
}

// Analytics (admin only)
router.get(
  "/analytics",
  rateLimit.strictRateLimit,
  paymentController.getPaymentAnalytics
);

module.exports = router;
