const { Coupon, CouponUsage, User, ServiceRequest } = require("../../models");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class CouponService {
  /**
   * Validate and apply coupon
   */
  async validateAndApplyCoupon(couponCode, userId, amount, serviceType = null) {
    try {
      // Find coupon by code
      const coupon = await Coupon.findOne({
        where: {
          code: couponCode.toUpperCase(),
          isActive: true,
        },
      });

      if (!coupon) {
        return {
          valid: false,
          message: "Invalid coupon code",
        };
      }

      // Check if coupon is valid
      if (!coupon.isValid()) {
        return {
          valid: false,
          message: "Coupon has expired or is not active",
        };
      }

      // Check minimum order amount
      if (coupon.minOrderAmount && amount < parseFloat(coupon.minOrderAmount)) {
        return {
          valid: false,
          message: `Minimum order amount of ₹${coupon.minOrderAmount} required`,
        };
      }

      // Check if coupon applies to this service type
      if (
        coupon.applicableServiceTypes &&
        coupon.applicableServiceTypes.length > 0 &&
        serviceType &&
        !coupon.applicableServiceTypes.includes(serviceType)
      ) {
        return {
          valid: false,
          message: "Coupon not applicable for this service type",
        };
      }

      // Check if user can use this coupon
      const canUse = await coupon.canBeUsedBy(userId);
      if (!canUse) {
        return {
          valid: false,
          message: "You have already used this coupon maximum number of times",
        };
      }

      // Calculate discount
      const discountAmount = coupon.calculateDiscount(amount);
      const finalAmount = amount - discountAmount;

      return {
        valid: true,
        couponId: coupon.id,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        finalAmount: parseFloat(finalAmount.toFixed(2)),
        message: "Coupon applied successfully",
      };
    } catch (error) {
      logger.error("Error validating coupon:", error);
      throw error;
    }
  }

  /**
   * Record coupon usage
   */
  async recordCouponUsage(
    couponId,
    userId,
    serviceRequestId,
    paymentId,
    originalAmount,
    discountAmount,
    finalAmount
  ) {
    try {
      // Create coupon usage record
      const couponUsage = await CouponUsage.create({
        couponId,
        userId,
        serviceRequestId,
        paymentId,
        originalAmount,
        discountAmount,
        finalAmount,
      });

      // Increment coupon usage count
      await Coupon.increment("usageCount", {
        where: { id: couponId },
      });

      return couponUsage;
    } catch (error) {
      logger.error("Error recording coupon usage:", error);
      throw error;
    }
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code) {
    try {
      const coupon = await Coupon.findOne({
        where: {
          code: code.toUpperCase(),
        },
      });

      return coupon;
    } catch (error) {
      logger.error("Error getting coupon by code:", error);
      throw error;
    }
  }

  /**
   * Create new coupon (Admin only)
   */
  async createCoupon(couponData) {
    try {
      const coupon = await Coupon.create({
        ...couponData,
        code: couponData.code.toUpperCase(),
      });

      return coupon;
    } catch (error) {
      logger.error("Error creating coupon:", error);
      throw error;
    }
  }

  /**
   * Update coupon (Admin only)
   */
  async updateCoupon(couponId, updateData) {
    try {
      const coupon = await Coupon.findByPk(couponId);
      if (!coupon) {
        throw new Error("Coupon not found");
      }

      if (updateData.code) {
        updateData.code = updateData.code.toUpperCase();
      }

      await coupon.update(updateData);
      return coupon;
    } catch (error) {
      logger.error("Error updating coupon:", error);
      throw error;
    }
  }

  /**
   * Delete/Deactivate coupon (Admin only)
   */
  async deactivateCoupon(couponId) {
    try {
      const coupon = await Coupon.findByPk(couponId);
      if (!coupon) {
        throw new Error("Coupon not found");
      }

      await coupon.update({ isActive: false });
      return coupon;
    } catch (error) {
      logger.error("Error deactivating coupon:", error);
      throw error;
    }
  }

  /**
   * Get all coupons (Admin only)
   */
  async getAllCoupons(filters = {}) {
    try {
      const where = {};

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.search) {
        where[Op.or] = [
          { code: { [Op.iLike]: `%${filters.search}%` } },
          { description: { [Op.iLike]: `%${filters.search}%` } },
        ];
      }

      const coupons = await Coupon.findAll({
        where,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: CouponUsage,
            as: "usages",
            attributes: ["id", "userId", "usedAt"],
          },
        ],
      });

      return coupons;
    } catch (error) {
      logger.error("Error getting all coupons:", error);
      throw error;
    }
  }

  /**
   * Get coupon usage history
   */
  async getCouponUsageHistory(couponId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      const { rows, count } = await CouponUsage.findAndCountAll({
        where: { couponId },
        limit,
        offset,
        order: [["usedAt", "DESC"]],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
          {
            model: ServiceRequest,
            as: "serviceRequest",
            attributes: ["id", "serviceType", "status"],
          },
        ],
      });

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting coupon usage history:", error);
      throw error;
    }
  }

  /**
   * Get user's coupon usage history
   */
  async getUserCouponUsage(userId) {
    try {
      const usages = await CouponUsage.findAll({
        where: { userId },
        order: [["usedAt", "DESC"]],
        include: [
          {
            model: Coupon,
            as: "coupon",
            attributes: ["id", "code", "discountType", "discountValue"],
          },
          {
            model: ServiceRequest,
            as: "serviceRequest",
            attributes: ["id", "serviceType", "status"],
          },
        ],
      });

      return usages;
    } catch (error) {
      logger.error("Error getting user coupon usage:", error);
      throw error;
    }
  }

  /**
   * Get active coupons for user
   */
  async getActiveCouponsForUser(userId) {
    try {
      const now = new Date();

      const coupons = await Coupon.findAll({
        where: {
          isActive: true,
          validFrom: { [Op.lte]: now },
          validUntil: { [Op.gte]: now },
          [Op.or]: [
            { maxUsageLimit: null },
            {
              usageCount: {
                [Op.lt]: Coupon.sequelize.col("maxUsageLimit"),
              },
            },
          ],
        },
        order: [["discountValue", "DESC"]],
      });

      // Filter coupons user can use
      const availableCoupons = [];
      for (const coupon of coupons) {
        const canUse = await coupon.canBeUsedBy(userId);
        if (canUse) {
          availableCoupons.push({
            id: coupon.id,
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscountAmount: coupon.maxDiscountAmount,
            minOrderAmount: coupon.minOrderAmount,
            validUntil: coupon.validUntil,
            applicableServiceTypes: coupon.applicableServiceTypes,
          });
        }
      }

      return availableCoupons;
    } catch (error) {
      logger.error("Error getting active coupons for user:", error);
      throw error;
    }
  }
}

module.exports = new CouponService();
