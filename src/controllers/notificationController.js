const notificationService = require("../services/notificationService");
const logger = require("../config/logger");

class NotificationController {
  /**
   * Get user notifications
   * GET /notifications
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const notifications = await notificationService.getUserNotifications(
        userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: notifications.data,
        pagination: notifications.pagination,
        unreadCount: notifications.unreadCount,
      });
    } catch (error) {
      logger.error("Error in getNotifications:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Mark notification as read
   * POST /notifications/mark-read
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.body;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: "Notification ID is required",
        });
      }

      await notificationService.markAsRead(notificationId, userId);

      res.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      logger.error("Error in markAsRead:", error);

      if (error.message === "Notification not found") {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Mark all notifications as read
   * POST /notifications/mark-all-read
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      logger.error("Error in markAllAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Send bulk notification (admin only)
   * POST /notifications/send-bulk
   */
  async sendBulkNotification(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const { userIds, title, message, type = "info", data } = req.body;

      if (!userIds || !Array.isArray(userIds) || !title || !message) {
        return res.status(400).json({
          success: false,
          message: "User IDs, title, and message are required",
        });
      }

      const count = await notificationService.sendBulkNotifications(
        userIds,
        title,
        message,
        type,
        data
      );

      res.json({
        success: true,
        message: `Notifications sent to ${count} users`,
      });
    } catch (error) {
      logger.error("Error in sendBulkNotification:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new NotificationController();
