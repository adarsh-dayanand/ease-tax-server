const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const documentService = require("../services/documentService");
const { authenticateToken } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Document upload middleware
const upload = documentService.getUploadMiddleware();

// Public routes (guidelines and types)
router.get(
  "/types",
  rateLimit.apiRateLimit,
  securityHeaders,
  documentController.getDocumentTypes
);
router.get(
  "/guidelines",
  rateLimit.apiRateLimit,
  securityHeaders,
  documentController.getUploadGuidelines
);

// Apply authentication to remaining routes
router.use(authenticateToken);
router.use(securityHeaders);
router.use(sanitizeInput);

// Document upload
router.post(
  "/upload",
  rateLimit.uploadRateLimit,
  upload,
  documentController.uploadDocument
);

// Document management
router.get(
  "/:docId",
  rateLimit.apiRateLimit,
  documentController.getDocumentDetails
);
router.get(
  "/:docId/download",
  rateLimit.downloadRateLimit,
  documentController.downloadDocument
);
router.get(
  "/:docId/status",
  rateLimit.apiRateLimit,
  documentController.getDocumentStatus
);
router.delete(
  "/:docId",
  rateLimit.apiRateLimit,
  documentController.deleteDocument
);

module.exports = router;
