const express = require("express");
const router = express.Router();
const caManagementController = require("../controllers/caManagementController");
const caServiceController = require("../controllers/caServiceController");
const documentService = require("../services/documentService");
const { authenticateToken, requireRole } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Document upload middleware
const upload = documentService.getUploadMiddleware();

// Apply middleware to all routes
router.use(authenticateToken);
router.use(requireRole("ca"));
router.use(securityHeaders);
router.use(sanitizeInput);

// CA dashboard and requests management
router.get(
  "/dashboard",
  rateLimit.apiRateLimit,
  caManagementController.getCADashboard
);

router.get(
  "/requests",
  rateLimit.apiRateLimit,
  caManagementController.getCARequests
);

router.get(
  "/requests/:requestId",
  rateLimit.apiRateLimit,
  caManagementController.getRequestDetails
);

router.post(
  "/requests/:requestId/accept",
  rateLimit.apiRateLimit,
  caManagementController.acceptRequest
);

router.post(
  "/requests/:requestId/reject",
  rateLimit.apiRateLimit,
  caManagementController.rejectRequest
);

// Service request status management
router.put(
  "/requests/:requestId/status",
  rateLimit.apiRateLimit,
  caManagementController.updateRequestStatus
);

router.post(
  "/requests/:requestId/complete",
  rateLimit.apiRateLimit,
  caManagementController.markRequestComplete
);

// Update estimated amount for a service request
router.patch(
  "/requests/:requestId/estimated-amount",
  rateLimit.apiRateLimit,
  caManagementController.updateEstimatedAmount
);

// Profile management
router.get(
  "/profile",
  rateLimit.apiRateLimit,
  caManagementController.getProfile
);

router.put(
  "/profile",
  rateLimit.apiRateLimit,
  caManagementController.updateProfile
);

// Service pricing management
router.get(
  "/services",
  rateLimit.apiRateLimit,
  caServiceController.getServices
);

router.post(
  "/services",
  rateLimit.apiRateLimit,
  caServiceController.upsertService
);

router.put(
  "/services/:serviceId",
  rateLimit.apiRateLimit,
  caServiceController.upsertService
);

router.delete(
  "/services/:serviceId",
  rateLimit.apiRateLimit,
  caServiceController.deleteService
);

router.post(
  "/services/bulk-update",
  rateLimit.apiRateLimit,
  caServiceController.bulkUpdateServices
);

router.get(
  "/services/available",
  rateLimit.apiRateLimit,
  caServiceController.getAvailableServices
);

router.get(
  "/services/templates",
  rateLimit.apiRateLimit,
  caServiceController.getServiceTemplates
);

router.post(
  "/services/initialize-defaults",
  rateLimit.apiRateLimit,
  caServiceController.initializeDefaultServices
);

// Meeting/VC scheduling
router.post(
  "/requests/:requestId/schedule-meeting",
  rateLimit.apiRateLimit,
  caManagementController.scheduleMeeting
);

router.put(
  "/meetings/:meetingId/reschedule",
  rateLimit.apiRateLimit,
  caManagementController.rescheduleMeeting
);

// Document management
router.post(
  "/requests/:requestId/upload-itr-v",
  rateLimit.uploadRateLimit,
  upload,
  caManagementController.uploadITRVDocument
);

module.exports = router;
