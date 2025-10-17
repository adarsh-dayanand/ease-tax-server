const express = require("express");
const router = express.Router();
const vcController = require("../controllers/vcController");
const { authenticateToken } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Public route for providers
router.get(
  "/providers",
  rateLimit.apiRateLimit,
  securityHeaders,
  vcController.getProviders
);

// Apply authentication to remaining routes
router.use(authenticateToken);
router.use(securityHeaders);
router.use(sanitizeInput);

// Meeting management
router.post("/schedule", rateLimit.apiRateLimit, vcController.scheduleMeeting);
router.put(
  "/:meetingId/reschedule",
  rateLimit.apiRateLimit,
  vcController.rescheduleMeeting
);
router.get(
  "/:meetingId/status",
  rateLimit.apiRateLimit,
  vcController.getMeetingStatus
);
router.delete(
  "/:meetingId",
  rateLimit.apiRateLimit,
  vcController.cancelMeeting
);

module.exports = router;
