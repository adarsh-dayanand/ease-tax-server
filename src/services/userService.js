const { User, ServiceRequest, Payment, Review } = require("../../models");
const cacheService = require("./cacheService");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class UserService {
  /**
   * Get user profile with caching
   */
  async getUserProfile(userId) {
    try {
      const cacheKey = cacheService.getCacheKeys().USER_PROFILE(userId);

      // Try to get from cache first
      let userProfile = await cacheService.get(cacheKey);

      if (!userProfile) {
        // Get from database - User model doesn't have password field (OAuth only)
        userProfile = await User.findByPk(userId, {
          include: [
            {
              model: ServiceRequest,
              as: "serviceRequests",
              limit: 5,
              order: [["createdAt", "DESC"]],
              include: [
                {
                  model: Review,
                  as: "review",
                },
              ],
            },
          ],
        });

        if (!userProfile) {
          return null;
        }

        // Transform data for API response using actual User model fields
        const userData = {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email,
          profileImage: userProfile.profileImage, // actual field name is profileImage
          phone: userProfile.phone,
          role: "user", // Users are always 'user' role
          pan: userProfile.pan,
          gstin: userProfile.gstin,
          phoneVerified: userProfile.phoneVerified,
          recentFilings:
            userProfile.serviceRequests?.map((sr) => ({
              id: sr.id,
              year: this.getTaxYear(sr.createdAt),
              status: sr.status,
              ca: sr.ca?.name || "Pending CA Assignment",
              filedDate: sr.completedAt || sr.updatedAt,
              refundAmount: sr.finalAmount ? `₹${sr.finalAmount}` : "TBD",
            })) || [],
        };

        // Cache for 30 minutes
        await cacheService.set(cacheKey, userData, 1800);
        userProfile = userData;
      }

      return userProfile;
    } catch (error) {
      logger.error("Error getting user profile:", error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updateData) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error("User not found");
      }

      await user.update(updateData);

      // Clear cache
      const cacheKey = cacheService.getCacheKeys().USER_PROFILE(userId);
      await cacheService.del(cacheKey);

      // Return updated profile
      return await this.getUserProfile(userId);
    } catch (error) {
      logger.error("Error updating user profile:", error);
      throw error;
    }
  }

  /**
   * Get user consultations with caching
   */
  async getUserConsultations(userId, page = 1, limit = 10) {
    try {
      const cacheKey = cacheService.getCacheKeys().USER_CONSULTATIONS(userId);

      let consultations = await cacheService.get(cacheKey);

      if (!consultations) {
        const offset = (page - 1) * limit;

        const { rows, count } = await ServiceRequest.findAndCountAll({
          where: { userId },
          limit,
          offset,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: require("../../models").CA,
              as: "ca",
              attributes: ["id", "name", "profileImage", "location"],
            },
          ],
        });

        consultations = {
          data: rows.map((sr) => ({
            id: sr.id,
            caName: sr.ca?.name || "Pending CA Assignment",
            caImage: sr.ca?.profileImage,
            caSpecialization: "Tax Consultant", // Default since specialization is in separate table
            date: sr.scheduledDate,
            time: sr.scheduledTime,
            type: "video", // Default consultation type
            purpose: sr.purpose,
            status: sr.status,
            paymentStatus: this.getPaymentStatus(sr.payments),
            durationMinutes: 30, // Default duration
            price: sr.estimatedAmount || sr.finalAmount,
            currency: "INR",
            notes: sr.additionalNotes,
            progress: this.calculateProgress(sr.status),
            createdAt: sr.createdAt,
            updatedAt: sr.updatedAt,
          })),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        };

        // Cache for 15 minutes
        await cacheService.set(cacheKey, consultations, 900);
      }

      return consultations;
    } catch (error) {
      logger.error("Error getting user consultations:", error);
      throw error;
    }
  }

  /**
   * Get user filings with caching
   */
  async getUserFilings(userId, page = 1, limit = 10) {
    try {
      const cacheKey = cacheService.getCacheKeys().USER_FILINGS(userId);

      let filings = await cacheService.get(cacheKey);

      if (!filings) {
        const offset = (page - 1) * limit;

        const { rows, count } = await ServiceRequest.findAndCountAll({
          where: {
            userId,
            status: { [Op.in]: ["completed", "in_progress"] },
          },
          limit,
          offset,
          order: [["completedAt", "DESC"]],
          include: [
            {
              model: require("../../models").CA,
              as: "ca",
              attributes: ["id", "name", "location"],
            },
          ],
        });

        filings = {
          data: rows.map((sr) => ({
            id: sr.id,
            year: this.getTaxYear(sr.createdAt),
            status: sr.status,
            ca: sr.ca?.name || "CA Name",
            caLocation: sr.ca?.location,
            filedDate: sr.completedAt,
            refundAmount: sr.finalAmount ? `₹${sr.finalAmount}` : "TBD",
            serviceType: sr.serviceType,
          })),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        };

        // Cache for 1 hour
        await cacheService.set(cacheKey, filings, 3600);
      }

      return filings;
    } catch (error) {
      logger.error("Error getting user filings:", error);
      throw error;
    }
  }

  /**
   * Get user payments with caching
   */
  async getUserPayments(userId, page = 1, limit = 10) {
    try {
      const cacheKey = cacheService.getCacheKeys().USER_PAYMENTS(userId);

      let payments = await cacheService.get(cacheKey);

      if (!payments) {
        const offset = (page - 1) * limit;

        const { rows, count } = await Payment.findAndCountAll({
          where: { userId },
          limit,
          offset,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: ServiceRequest,
              as: "serviceRequest",
              include: [
                {
                  model: User,
                  as: "ca",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        });

        payments = {
          data: rows.map((payment) => ({
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            type: payment.type,
            paymentMethod: payment.paymentMethod,
            transactionId: payment.transactionId,
            serviceRequestId: payment.serviceRequestId,
            caName: payment.serviceRequest?.ca?.name,
            purpose: payment.description,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
          })),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        };

        // Cache for 30 minutes
        await cacheService.set(cacheKey, payments, 1800);
      }

      return payments;
    } catch (error) {
      logger.error("Error getting user payments:", error);
      throw error;
    }
  }

  /**
   * Calculate progress based on status
   */
  calculateProgress(status) {
    const progressMap = {
      pending: 10,
      accepted: 20,
      in_progress: 50,
      completed: 100,
      cancelled: 0,
      rejected: 0,
      escalated: 30,
    };

    return progressMap[status] || 0;
  }

  /**
   * Get tax year from date
   */
  getTaxYear(date) {
    const year = new Date(date).getFullYear();
    return `AY ${year + 1}-${(year + 2).toString().slice(-2)}`;
  }

  /**
   * Get payment status from payments array
   */
  getPaymentStatus(payments) {
    if (!payments || payments.length === 0) return "unpaid";

    const hasSuccessfulPayment = payments.some(
      (p) => p.status === "success" || p.status === "completed"
    );
    const hasPendingPayment = payments.some((p) => p.status === "pending");

    if (hasSuccessfulPayment) return "paid";
    if (hasPendingPayment) return "pending";
    return "unpaid";
  }

  /**
   * Clear user related cache
   */
  async clearUserCache(userId) {
    try {
      const keys = cacheService.getCacheKeys();
      await Promise.all([
        cacheService.del(keys.USER_PROFILE(userId)),
        cacheService.del(keys.USER_CONSULTATIONS(userId)),
        cacheService.del(keys.USER_FILINGS(userId)),
        cacheService.del(keys.USER_PAYMENTS(userId)),
      ]);
    } catch (error) {
      logger.error("Error clearing user cache:", error);
    }
  }
}

module.exports = new UserService();
