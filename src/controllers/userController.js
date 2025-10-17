const userService = require("../services/userService");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

class UserController {
  /**
   * Get user profile
   * GET /users/:userId
   */
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;

      // Validate user access (users can only access their own profile)
      if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const userProfile = await userService.getUserProfile(userId);

      if (!userProfile) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: userProfile,
      });
    } catch (error) {
      logger.error("Error in getUserProfile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update user profile
   * PUT /users/:userId
   */
  async updateUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const updateData = req.body;

      // Validate user access
      if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updateData.id;
      delete updateData.role;
      delete updateData.password;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const updatedProfile = await userService.updateUserProfile(
        userId,
        updateData
      );

      res.json({
        success: true,
        data: updatedProfile,
        message: "Profile updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateUserProfile:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  /**
   * Get user consultations
   * GET /users/:userId/consultations
   */
  async getUserConsultations(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Validate user access
      if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const consultations = await userService.getUserConsultations(
        userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: consultations.data,
        pagination: consultations.pagination,
      });
    } catch (error) {
      logger.error("Error in getUserConsultations:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get user filings
   * GET /users/:userId/filings
   */
  async getUserFilings(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Validate user access
      if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const filings = await userService.getUserFilings(
        userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: filings.data,
        pagination: filings.pagination,
      });
    } catch (error) {
      logger.error("Error in getUserFilings:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get user payments
   * GET /users/:userId/payments
   */
  async getUserPayments(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Validate user access
      if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const payments = await userService.getUserPayments(
        userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: payments.data,
        pagination: payments.pagination,
      });
    } catch (error) {
      logger.error("Error in getUserPayments:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get user dashboard data
   * GET /users/:userId/dashboard
   */
  async getUserDashboard(req, res) {
    try {
      const { userId } = req.params;

      // Validate user access
      if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Get recent data for dashboard
      const [profile, consultations, filings, payments] = await Promise.all([
        userService.getUserProfile(userId),
        userService.getUserConsultations(userId, 1, 5),
        userService.getUserFilings(userId, 1, 5),
        userService.getUserPayments(userId, 1, 5),
      ]);

      const dashboardData = {
        profile,
        recentConsultations: consultations.data,
        recentFilings: filings.data,
        recentPayments: payments.data,
        stats: {
          totalConsultations: consultations.pagination.total,
          completedFilings: filings.pagination.total,
          totalPayments: payments.pagination.total,
        },
      };

      res.json({
        success: true,
        data: dashboardData,
      });
    } catch (error) {
      logger.error("Error in getUserDashboard:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Clear user cache (admin only)
   * DELETE /users/:userId/cache
   */
  async clearUserCache(req, res) {
    try {
      const { userId } = req.params;

      // Only admin can clear cache
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      await userService.clearUserCache(userId);

      res.json({
        success: true,
        message: "User cache cleared successfully",
      });
    } catch (error) {
      logger.error("Error in clearUserCache:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new UserController();
