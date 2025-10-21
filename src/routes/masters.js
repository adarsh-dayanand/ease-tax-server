const express = require("express");
const router = express.Router();
const caServiceController = require("../controllers/caServiceController");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Public routes (no authentication required)
router.get(
  "/services",
  rateLimit.apiRateLimit,
  securityHeaders,
  sanitizeInput,
  caServiceController.getMasterServices
);

module.exports = router;
