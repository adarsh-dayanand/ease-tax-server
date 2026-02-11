const { User, ServiceRequest, Payment, Review, CA } = require("../../models");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class UserService {
  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: ServiceRequest,
            as: "serviceRequests",
            limit: 5,
            order: [["createdAt", "DESC"]],
            include: [{ model: CA, as: "ca", attributes: ["name"] }],
          },
        ],
      });

      if (!user) {
        return null;
      }

      // Transform data for API response
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        phone: user.phone,
        countryCode: user.countryCode || null,
        role: "user",
        pan: user.pan,
        gstin: user.gstin,
        phoneVerified: user.phoneVerified,
        recentFilings:
          user.serviceRequests?.map((sr) => ({
            id: sr.id,
            year: this.getTaxYear(sr.createdAt),
            status: sr.status,
            ca: sr.ca?.name || "Pending CA Assignment",
            filedDate: sr.completedAt || sr.updatedAt,
            refundAmount: "TBD",
          })) || [],
      };
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
      return this.getUserProfile(userId);
    } catch (error) {
      logger.error("Error updating user profile:", error);
      throw error;
    }
  }

  /**
   * Get user consultations
   */
  async getUserConsultations(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const { rows, count } = await ServiceRequest.findAndCountAll({
        where: { userId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          { model: CA, as: "ca", attributes: ["id", "name", "profileImage"] },
          {
            model: Payment,
            as: "payments",
            attributes: ["status", "paymentType"],
          },
        ],
      });

      const consultations = rows.map((sr) => ({
        id: sr.id,
        caId: sr.caId,
        caName: sr.ca?.name || "Pending",
        caImage: sr.ca?.profileImage,
        purpose: sr.purpose,
        status: sr.status,
        paymentStatus: this.getPaymentStatus(sr.payments),
        progress: this.calculateProgress(sr.status),
        createdAt: sr.createdAt,
      }));

      return {
        data: consultations,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting user consultations:", error);
      throw error;
    }
  }

  /**
   * Get user filings
   */
  async getUserFilings(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const { rows, count } = await ServiceRequest.findAndCountAll({
        where: {
          userId,
          status: { [Op.in]: ["completed", "in_progress"] },
        },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [{ model: CA, as: "ca", attributes: ["name"] }],
      });

      const filings = rows.map((sr) => ({
        id: sr.id,
        year: this.getTaxYear(sr.createdAt),
        status: sr.status,
        ca: sr.ca?.name || "System",
        filedDate: sr.completedAt || sr.updatedAt,
      }));

      return {
        data: filings,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting user filings:", error);
      throw error;
    }
  }

  /**
   * Get user payments
   */
  async getUserPayments(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const { rows, count } = await Payment.findAndCountAll({
        where: { userId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
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
   * Clear user related cache (No-op after Redis removal)
   */
  async clearUserCache(userId) {
    return true;
  }
}

module.exports = new UserService();
