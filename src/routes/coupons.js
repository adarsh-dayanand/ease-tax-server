const express = require("express");
const router = express.Router();
const couponController = require("../controllers/couponController");
const { authenticateToken } = require("../middleware/auth");

// User routes
router.post("/validate", authenticateToken, couponController.validateCoupon);
router.get("/active", authenticateToken, couponController.getActiveCoupons);
router.get(
  "/history",
  authenticateToken,
  couponController.getUserCouponHistory
);

// Admin routes (add admin middleware as needed)
router.post("/admin", authenticateToken, couponController.createCoupon);
router.put(
  "/admin/:couponId",
  authenticateToken,
  couponController.updateCoupon
);
router.delete(
  "/admin/:couponId",
  authenticateToken,
  couponController.deactivateCoupon
);
router.get("/admin", authenticateToken, couponController.getAllCoupons);
router.get(
  "/admin/:couponId/usage",
  authenticateToken,
  couponController.getCouponUsageHistory
);

module.exports = router;
