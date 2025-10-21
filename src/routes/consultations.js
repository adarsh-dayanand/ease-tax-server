const express = require("express");
const router = express.Router();
const consultationController = require("../controllers/consultationController");
const documentController = require("../controllers/documentController");
const documentService = require("../services/documentService");
const { authenticateToken } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Document upload middleware
const upload = documentService.getUploadMiddleware();

// Apply middleware to all routes
router.use(authenticateToken);
router.use(securityHeaders);
router.use(sanitizeInput);

// Consultation booking (moved to users route as per API spec)
// POST /users/consultations will be handled in users routes

// Consultation management
router.get(
  "/:consultationId",
  rateLimit.apiRateLimit,
  consultationController.getConsultationDetails
);
router.post(
  "/:consultationId/cancel",
  rateLimit.apiRateLimit,
  consultationController.cancelConsultation
);
router.put(
  "/:consultationId/status",
  rateLimit.apiRateLimit,
  consultationController.updateConsultationStatus
);

// Consultation messages (READ-ONLY via REST - WebSocket for real-time chat)
router.get(
  "/:consultationId/messages",
  rateLimit.apiRateLimit,
  consultationController.getConsultationMessages
);
// Note: Use WebSocket for sending messages in real-time

// Consultation documents
router.get(
  "/:consultationId/documents",
  rateLimit.apiRateLimit,
  consultationController.getConsultationDocuments
);
router.post(
  "/:consultationId/documents",
  rateLimit.uploadRateLimit,
  upload,
  documentController.uploadConsultationDocument
);
router.delete(
  "/:consultationId/documents/:docId",
  rateLimit.apiRateLimit,
  documentController.deleteDocument
);

// Analytics (admin only)
router.get(
  "/analytics",
  rateLimit.strictRateLimit,
  consultationController.getConsultationAnalytics
);

module.exports = router;
