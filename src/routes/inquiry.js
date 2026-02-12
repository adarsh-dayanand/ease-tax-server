const express = require("express");
const router = express.Router();
const inquiryController = require("../controllers/inquiryController");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Public route with strict rate limiting
router.post(
  "/",
  rateLimit.strictRateLimit,
  securityHeaders,
  sanitizeInput,
  inquiryController.submitInquiry,
);

module.exports = router;
