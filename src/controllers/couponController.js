const couponService = require("../services/couponService");
const logger = require("../config/logger");

class CouponController {
  /**
   * Validate coupon
   */
  async validateCoupon(req, res) {
    try {
      const { code, amount, serviceType } = req.body;
      const userId = req.user.id;

      if (!code || !amount) {
        return res.status(400).json({
          success: false,
          message: "Coupon code and amount are required",
        });
      }

      const result = await couponService.validateAndApplyCoupon(
        code,
        userId,
        parseFloat(amount),
        serviceType
      );

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Error in validateCoupon:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate coupon",
      });
    }
  }

  /**
   * Get active coupons for user
   */
  async getActiveCoupons(req, res) {
    try {
      const userId = req.user.id;

      const coupons = await couponService.getActiveCouponsForUser(userId);

      res.json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      logger.error("Error in getActiveCoupons:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get active coupons",
      });
    }
  }

  /**
   * Get user's coupon usage history
   */
  async getUserCouponHistory(req, res) {
    try {
      const userId = req.user.id;

      const usages = await couponService.getUserCouponUsage(userId);

      res.json({
        success: true,
        data: usages,
      });
    } catch (error) {
      logger.error("Error in getUserCouponHistory:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get coupon history",
      });
    }
  }

  // Admin endpoints
  /**
   * Create new coupon (Admin only)
   */
  async createCoupon(req, res) {
    try {
      const couponData = req.body;

      const coupon = await couponService.createCoupon(couponData);

      res.status(201).json({
        success: true,
        data: coupon,
        message: "Coupon created successfully",
      });
    } catch (error) {
      logger.error("Error in createCoupon:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create coupon",
      });
    }
  }

  /**
   * Update coupon (Admin only)
   */
  async updateCoupon(req, res) {
    try {
      const { couponId } = req.params;
      const updateData = req.body;

      const coupon = await couponService.updateCoupon(couponId, updateData);

      res.json({
        success: true,
        data: coupon,
        message: "Coupon updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateCoupon:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update coupon",
      });
    }
  }

  /**
   * Deactivate coupon (Admin only)
   */
  async deactivateCoupon(req, res) {
    try {
      const { couponId } = req.params;

      const coupon = await couponService.deactivateCoupon(couponId);

      res.json({
        success: true,
        data: coupon,
        message: "Coupon deactivated successfully",
      });
    } catch (error) {
      logger.error("Error in deactivateCoupon:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to deactivate coupon",
      });
    }
  }

  /**
   * Get all coupons (Admin only)
   */
  async getAllCoupons(req, res) {
    try {
      const filters = {
        isActive: req.query.isActive,
        search: req.query.search,
      };

      const coupons = await couponService.getAllCoupons(filters);

      res.json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      logger.error("Error in getAllCoupons:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get coupons",
      });
    }
  }

  /**
   * Get coupon usage history (Admin only)
   */
  async getCouponUsageHistory(req, res) {
    try {
      const { couponId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await couponService.getCouponUsageHistory(
        couponId,
        page,
        limit
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error in getCouponUsageHistory:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get coupon usage history",
      });
    }
  }
}

module.exports = new CouponController();
