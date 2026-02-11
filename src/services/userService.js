const { User, ServiceRequest, Payment, Review } = require("../../models");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class UserService {
  /**
   * Get user profile with caching
   */
  async getUserProfile(userId) {
    try {
      

        // Transform data for API response using actual User model fields
        const userData = {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email,
          profileImage: userProfile.profileImage, // actual field name is profileImage
          phone: userProfile.phone,
          countryCode: userProfile.countryCode || null,
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
              refundAmount: "TBD",
            })) || [],
        };

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

            ),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        };

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
       catch (error) {
      logger.error("Error getting user filings:", error);
      throw error;
    }
  }

  /**
   * Get user payments with caching
   */
  async getUserPayments(userId, page = 1, limit = 10) {
    try {
       catch (error) {
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
      (p) => p.status === "success" || p.status === "completed",
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
    try {    } catch (error) {
      logger.error("Error clearing user cache:", error);
    }
  }
}

module.exports = new UserService();
