const express = require("express");
const router = express.Router();
const caController = require("../controllers/caController");
const caServiceController = require("../controllers/caServiceController");
const { authenticateToken } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { securityHeaders, sanitizeInput } = require("../middleware/security");

// Public routes (no authentication required)
router.get(
  "/specializations",
  rateLimit.apiRateLimit,
  securityHeaders,
  sanitizeInput,
  caController.getSpecializations
);
router.get(
  "/popular",
  rateLimit.apiRateLimit,
  securityHeaders,
  sanitizeInput,
  caController.getPopularCAs
);

// CA services pricing (public routes)
router.get(
  "/:caId/services",
  rateLimit.apiRateLimit,
  securityHeaders,
  sanitizeInput,
  caServiceController.getPublicServices
);

// Apply authentication to remaining routes
router.use(authenticateToken);
router.use(securityHeaders);
router.use(sanitizeInput);

// CA search and listing
router.get("/", rateLimit.apiRateLimit, caController.searchCAs);

// CA profile and details
router.get("/:caId", rateLimit.apiRateLimit, caController.getCAProfile);
router.get("/:caId/reviews", rateLimit.apiRateLimit, caController.getCAReviews);
// Availability endpoints removed - CAs handle time slots through consultation requests

// CA consultation request
router.post(
  "/:caId/request",
  rateLimit.apiRateLimit,
  caController.requestConsultation
);

// Cache management (admin only)
router.delete(
  "/:caId/cache",
  rateLimit.strictRateLimit,
  caController.clearCACache
);

module.exports = router;
