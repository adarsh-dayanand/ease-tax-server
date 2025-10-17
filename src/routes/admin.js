const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const {
  authenticateToken,
  requireAdmin,
  requirePermission,
} = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Apply middleware to all routes - only admin access
router.use(authenticateToken);
router.use(requireAdmin);
router.use(securityHeaders);
router.use(sanitizeInput);

// CA Management
router.get("/cas", rateLimit.apiRateLimit, adminController.getAllCAs);

router.get(
  "/cas/pending-verification",
  rateLimit.apiRateLimit,
  adminController.getPendingCAs
);

router.post(
  "/cas/register",
  rateLimit.apiRateLimit,
  adminController.registerCA
);

router.put(
  "/cas/:caId/verify",
  rateLimit.apiRateLimit,
  adminController.verifyCA
);

router.put(
  "/cas/:caId/reject",
  rateLimit.apiRateLimit,
  adminController.rejectCA
);

router.put(
  "/cas/:caId/suspend",
  rateLimit.apiRateLimit,
  adminController.suspendCA
);

router.put(
  "/cas/:caId/activate",
  rateLimit.apiRateLimit,
  adminController.activateCA
);

// User Management
router.get("/users", rateLimit.apiRateLimit, adminController.getAllUsers);

router.put(
  "/users/:userId/suspend",
  rateLimit.apiRateLimit,
  adminController.suspendUser
);

router.put(
  "/users/:userId/activate",
  rateLimit.apiRateLimit,
  adminController.activateUser
);

// Service Request Management
router.get(
  "/service-requests",
  rateLimit.apiRateLimit,
  adminController.getAllServiceRequests
);

router.get(
  "/service-requests/escalated",
  rateLimit.apiRateLimit,
  adminController.getEscalatedRequests
);

router.put(
  "/service-requests/:requestId/assign-ca",
  rateLimit.apiRateLimit,
  adminController.assignCAToRequest
);

// Analytics
router.get(
  "/analytics/dashboard",
  rateLimit.apiRateLimit,
  adminController.getAdminDashboard
);

router.get(
  "/analytics/revenue",
  rateLimit.apiRateLimit,
  adminController.getRevenueAnalytics
);

router.get(
  "/analytics/ca-performance",
  rateLimit.apiRateLimit,
  adminController.getCAPerformanceAnalytics
);

// System Configuration
router.get("/config", rateLimit.apiRateLimit, adminController.getSystemConfig);

router.put(
  "/config",
  rateLimit.apiRateLimit,
  adminController.updateSystemConfig
);

module.exports = router;
