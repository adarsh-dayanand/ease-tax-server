const adminService = require("../services/adminService");
const notificationService = require("../services/notificationService");
const logger = require("../config/logger");

class AdminController {
  /**
   * Get all CAs
   * GET /admin/cas
   */
  async getAllCAs(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const result = await adminService.getAllCAs(
        status,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error in getAllCAs:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get pending CA verifications
   * GET /admin/cas/pending-verification
   */
  async getPendingCAs(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await adminService.getPendingCAs(
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error in getPendingCAs:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Register new CA (admin only)
   * POST /admin/cas/register
   */
  async registerCA(req, res) {
    try {
      const adminId = req.user.id;
      const caData = req.body;

      // Validate required fields
      const requiredFields = ["name", "email", "phone"];
      const missingFields = requiredFields.filter((field) => !caData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      const ca = await adminService.registerCA(caData, adminId);

      res.status(201).json({
        success: true,
        data: ca,
        message: "CA registered successfully",
      });
    } catch (error) {
      logger.error("Error in registerCA:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to register CA",
      });
    }
  }

  /**
   * Verify CA
   * PUT /admin/cas/:caId/verify
   */
  async verifyCA(req, res) {
    try {
      const { caId } = req.params;
      const adminId = req.user.id;
      const { verificationNotes } = req.body;

      const ca = await adminService.verifyCA(caId, adminId, verificationNotes);

      // Send notification to CA
      await notificationService.createNotification(
        caId,
        "ca",
        "account_verified",
        "Account Verified",
        "Your CA account has been verified and you can now start accepting consultations.",
        {
          priority: "high",
          templateData: { verificationNotes },
        }
      );

      res.json({
        success: true,
        data: ca,
        message: "CA verified successfully",
      });
    } catch (error) {
      logger.error("Error in verifyCA:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to verify CA",
      });
    }
  }

  /**
   * Reject CA verification
   * PUT /admin/cas/:caId/reject
   */
  async rejectCA(req, res) {
    try {
      const { caId } = req.params;
      const adminId = req.user.id;
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }

      const ca = await adminService.rejectCA(caId, adminId, rejectionReason);

      // Send notification to CA
      await notificationService.createNotification(
        caId,
        "ca",
        "account_rejected",
        "Account Verification Rejected",
        `Your CA account verification has been rejected. Reason: ${rejectionReason}`,
        {
          priority: "high",
          templateData: { rejectionReason },
        }
      );

      res.json({
        success: true,
        data: ca,
        message: "CA verification rejected",
      });
    } catch (error) {
      logger.error("Error in rejectCA:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to reject CA",
      });
    }
  }

  /**
   * Suspend CA
   * PUT /admin/cas/:caId/suspend
   */
  async suspendCA(req, res) {
    try {
      const { caId } = req.params;
      const adminId = req.user.id;
      const { suspensionReason } = req.body;

      if (!suspensionReason) {
        return res.status(400).json({
          success: false,
          message: "Suspension reason is required",
        });
      }

      const ca = await adminService.suspendCA(caId, adminId, suspensionReason);

      // Send notification to CA
      await notificationService.createNotification(
        caId,
        "ca",
        "account_suspended",
        "Account Suspended",
        `Your account has been suspended. Reason: ${suspensionReason}`,
        {
          priority: "urgent",
          templateData: { suspensionReason },
        }
      );

      res.json({
        success: true,
        data: ca,
        message: "CA suspended successfully",
      });
    } catch (error) {
      logger.error("Error in suspendCA:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to suspend CA",
      });
    }
  }

  /**
   * Activate CA
   * PUT /admin/cas/:caId/activate
   */
  async activateCA(req, res) {
    try {
      const { caId } = req.params;
      const adminId = req.user.id;
      const { activationNotes } = req.body;

      const ca = await adminService.activateCA(caId, adminId, activationNotes);

      // Send notification to CA
      await notificationService.createNotification(
        caId,
        "ca",
        "account_activated",
        "Account Activated",
        "Your account has been activated and you can resume accepting consultations.",
        {
          priority: "high",
          templateData: { activationNotes },
        }
      );

      res.json({
        success: true,
        data: ca,
        message: "CA activated successfully",
      });
    } catch (error) {
      logger.error("Error in activateCA:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to activate CA",
      });
    }
  }

  /**
   * Get all users
   * GET /admin/users
   */
  async getAllUsers(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const result = await adminService.getAllUsers(
        status,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error in getAllUsers:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Suspend user
   * PUT /admin/users/:userId/suspend
   */
  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;
      const { suspensionReason } = req.body;

      if (!suspensionReason) {
        return res.status(400).json({
          success: false,
          message: "Suspension reason is required",
        });
      }

      const user = await adminService.suspendUser(
        userId,
        adminId,
        suspensionReason
      );

      res.json({
        success: true,
        data: user,
        message: "User suspended successfully",
      });
    } catch (error) {
      logger.error("Error in suspendUser:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to suspend user",
      });
    }
  }

  /**
   * Activate user
   * PUT /admin/users/:userId/activate
   */
  async activateUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;
      const { activationNotes } = req.body;

      const user = await adminService.activateUser(
        userId,
        adminId,
        activationNotes
      );

      res.json({
        success: true,
        data: user,
        message: "User activated successfully",
      });
    } catch (error) {
      logger.error("Error in activateUser:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to activate user",
      });
    }
  }

  /**
   * Get all service requests
   * GET /admin/service-requests
   */
  async getAllServiceRequests(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const result = await adminService.getAllServiceRequests(
        status,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error in getAllServiceRequests:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get escalated requests
   * GET /admin/service-requests/escalated
   */
  async getEscalatedRequests(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await adminService.getEscalatedRequests(
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error in getEscalatedRequests:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Assign CA to request
   * PUT /admin/service-requests/:requestId/assign-ca
   */
  async assignCAToRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { caId } = req.body;
      const adminId = req.user.id;

      if (!caId) {
        return res.status(400).json({
          success: false,
          message: "CA ID is required",
        });
      }

      const result = await adminService.assignCAToRequest(
        requestId,
        caId,
        adminId
      );

      res.json({
        success: true,
        data: result,
        message: "CA assigned to request successfully",
      });
    } catch (error) {
      logger.error("Error in assignCAToRequest:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to assign CA to request",
      });
    }
  }

  /**
   * Get admin dashboard
   * GET /admin/analytics/dashboard
   */
  async getAdminDashboard(req, res) {
    try {
      const dashboard = await adminService.getAdminDashboard();

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error("Error in getAdminDashboard:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get revenue analytics
   * GET /admin/analytics/revenue
   */
  async getRevenueAnalytics(req, res) {
    try {
      const { period = "30d" } = req.query;

      const analytics = await adminService.getRevenueAnalytics(period);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error("Error in getRevenueAnalytics:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get CA performance analytics
   * GET /admin/analytics/ca-performance
   */
  async getCAPerformanceAnalytics(req, res) {
    try {
      const { period = "30d", limit = 10 } = req.query;

      const analytics = await adminService.getCAPerformanceAnalytics(
        period,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error("Error in getCAPerformanceAnalytics:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get system configuration
   * GET /admin/config
   */
  async getSystemConfig(req, res) {
    try {
      const config = await adminService.getSystemConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error("Error in getSystemConfig:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update system configuration
   * PUT /admin/config
   */
  async updateSystemConfig(req, res) {
    try {
      const adminId = req.user.id;
      const configUpdates = req.body;

      const config = await adminService.updateSystemConfig(
        configUpdates,
        adminId
      );

      res.json({
        success: true,
        data: config,
        message: "System configuration updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateSystemConfig:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update system configuration",
      });
    }
  }
}

module.exports = new AdminController();
