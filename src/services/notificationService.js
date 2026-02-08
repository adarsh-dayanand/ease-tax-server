const { Notification, User, CA, ServiceRequest } = require("../../models");
const cacheService = require("./cacheService");
const emailService = require("./emailService");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class NotificationService {
  constructor() {
    this.socketio = null; // Will be set from index.js
  }

  /**
   * Set Socket.IO instance for real-time notifications
   */
  setSocketIO(io) {
    this.socketio = io;
  }

  /**
   * Create notification
   */
  async createNotification(
    recipientId,
    recipientType,
    notificationType,
    title,
    message,
    options = {},
  ) {
    try {
      const {
        senderId = null,
        senderType = "system",
        serviceRequestId = null,
        channel = "in_app",
        priority = "medium",
        actionUrl = null,
        actionText = null,
        templateData = {},
        scheduledFor = null,
        expiresAt = null,
      } = options;

      const notification = await Notification.create({
        recipientId,
        recipientType,
        senderId,
        senderType,
        serviceRequestId,
        notificationType,
        channel,
        priority,
        title,
        message,
        actionUrl,
        actionText,
        templateData,
        scheduledFor,
        expiresAt,
        status: scheduledFor ? "pending" : "sent",
        isRead: false,
      });

      // Clear user notifications cache
      const cacheKey = cacheService
        .getCacheKeys()
        .USER_NOTIFICATIONS(recipientId);
      await cacheService.del(cacheKey);

      // Send real-time notification via WebSocket if immediate
      if (!scheduledFor && this.socketio) {
        await this.sendRealTimeNotification(
          recipientId,
          recipientType,
          notification,
        );
      }

      return notification;
    } catch (error) {
      logger.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Get user notifications with caching
   */
  async getUserNotifications(
    recipientId,
    recipientType = "user",
    page = 1,
    limit = 20,
    unreadOnly = false,
  ) {
    try {
      const cacheKey = cacheService
        .getCacheKeys()
        .USER_NOTIFICATIONS(`${recipientId}:${unreadOnly}:${page}:${limit}`);

      let notifications = await cacheService.get(cacheKey);

      if (!notifications) {
        const offset = (page - 1) * limit;

        const whereClause = {
          recipientId,
          recipientType,
          channel: "in_app",
        };

        if (unreadOnly) {
          whereClause.isRead = false;
        }

        const { rows, count } = await Notification.findAndCountAll({
          where: whereClause,
          limit,
          offset,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: ServiceRequest,
              as: "serviceRequest",
              required: false,
              attributes: ["id", "status", "purpose"],
            },
          ],
        });

        const unreadCount = await Notification.getUnreadCount(
          recipientId,
          recipientType,
        );

        notifications = {
          data: rows.map((notification) => ({
            id: notification.id,
            title: notification.title,
            message: notification.message,
            notificationType: notification.notificationType,
            priority: notification.priority,
            actionUrl: notification.actionUrl,
            actionText: notification.actionText,
            serviceRequestId: notification.serviceRequestId,
            isRead: notification.isRead,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
            serviceRequest: notification.serviceRequest
              ? {
                  id: notification.serviceRequest.id,
                  status: notification.serviceRequest.status,
                  purpose: notification.serviceRequest.purpose,
                }
              : null,
          })),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
          unreadCount,
        };

        // Cache for 5 minutes
        await cacheService.set(cacheKey, notifications, 300);
      }

      return notifications;
    } catch (error) {
      logger.error("Error getting user notifications:", error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, recipientId, recipientType = "user") {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          recipientId,
          recipientType,
        },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      await notification.markAsRead();

      // Clear cache
      const cacheKey = cacheService
        .getCacheKeys()
        .USER_NOTIFICATIONS(recipientId);
      await cacheService.del(cacheKey);

      return true;
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(recipientId, recipientType = "user") {
    try {
      await Notification.markAllAsRead(recipientId, recipientType);

      // Clear cache
      const cacheKey = cacheService
        .getCacheKeys()
        .USER_NOTIFICATIONS(recipientId);
      await cacheService.del(cacheKey);

      return true;
    } catch (error) {
      logger.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    recipients,
    notificationType,
    title,
    message,
    options = {},
  ) {
    try {
      const {
        senderId = null,
        senderType = "system",
        serviceRequestId = null,
        channel = "in_app",
        priority = "medium",
        actionUrl = null,
        actionText = null,
        templateData = {},
        scheduledFor = null,
        expiresAt = null,
      } = options;

      const notifications = recipients.map((recipient) => ({
        recipientId: recipient.id,
        recipientType: recipient.type,
        senderId,
        senderType,
        serviceRequestId,
        notificationType,
        channel,
        priority,
        title,
        message,
        actionUrl,
        actionText,
        templateData,
        scheduledFor,
        expiresAt,
        status: scheduledFor ? "pending" : "sent",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await Notification.bulkCreate(notifications);

      // Clear cache for all users
      for (const recipient of recipients) {
        const cacheKey = cacheService
          .getCacheKeys()
          .USER_NOTIFICATIONS(recipient.id);
        await cacheService.del(cacheKey);

        // Send real-time notification if immediate
        if (!scheduledFor && this.socketio) {
          await this.sendRealTimeNotification(recipient.id, recipient.type, {
            id: null, // Will be set after creation
            title,
            message,
            notificationType,
            priority,
            actionUrl,
            actionText,
            serviceRequestId,
            isRead: false,
            createdAt: new Date(),
          });
        }
      }

      return notifications.length;
    } catch (error) {
      logger.error("Error sending bulk notifications:", error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    recipientId,
    recipientType,
    notificationType,
    templateData,
  ) {
    try {
      // Get recipient email
      let recipientEmail;
      if (recipientType === "user") {
        const user = await User.findByPk(recipientId);
        recipientEmail = user?.email;
      } else if (recipientType === "ca") {
        const ca = await CA.findByPk(recipientId);
        recipientEmail = ca?.email;
      }

      if (!recipientEmail) {
        logger.warn(`No email found for ${recipientType} ${recipientId}`);
        return { success: false, reason: "No email address" };
      }

      // Send email using template
      const result = await emailService.sendTemplateEmail(
        recipientEmail,
        notificationType,
        templateData,
      );

      logger.info(
        `Email notification sent to ${recipientEmail} for ${notificationType}`,
      );
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error(`Error sending email notification:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create notification with multi-channel support
   */
  async createMultiChannelNotification(
    recipientId,
    recipientType,
    notificationType,
    title,
    message,
    options = {},
  ) {
    try {
      const {
        sendEmail = false,
        sendInApp = true,
        ...notificationOptions
      } = options;

      const results = {
        inApp: null,
        email: null,
      };

      // Create in-app notification
      if (sendInApp) {
        results.inApp = await this.createNotification(
          recipientId,
          recipientType,
          notificationType,
          title,
          message,
          { ...notificationOptions, channel: "in_app" },
        );
      }

      // Send email notification
      if (sendEmail) {
        const emailResult = await this.sendEmailNotification(
          recipientId,
          recipientType,
          notificationType,
          notificationOptions.templateData || {},
        );

        // Create email notification record
        if (emailResult.success) {
          results.email = await Notification.create({
            recipientId,
            recipientType,
            senderId: notificationOptions.senderId || null,
            senderType: notificationOptions.senderType || "system",
            serviceRequestId: notificationOptions.serviceRequestId || null,
            notificationType,
            channel: "email",
            priority: notificationOptions.priority || "medium",
            title,
            message,
            actionUrl: notificationOptions.actionUrl || null,
            actionText: notificationOptions.actionText || null,
            templateData: notificationOptions.templateData || {},
            status: "sent",
            sentAt: new Date(),
            externalId: emailResult.messageId,
            isRead: false,
          });
        } else {
          // Create failed email notification record
          results.email = await Notification.create({
            recipientId,
            recipientType,
            senderId: notificationOptions.senderId || null,
            senderType: notificationOptions.senderType || "system",
            serviceRequestId: notificationOptions.serviceRequestId || null,
            notificationType,
            channel: "email",
            priority: notificationOptions.priority || "medium",
            title,
            message,
            actionUrl: notificationOptions.actionUrl || null,
            actionText: notificationOptions.actionText || null,
            templateData: notificationOptions.templateData || {},
            status: "failed",
            failedAt: new Date(),
            failureReason: emailResult.error || emailResult.reason,
            isRead: false,
          });
        }
      }

      return results;
    } catch (error) {
      logger.error("Error creating multi-channel notification:", error);
      throw error;
    }
  }

  /**
   * Send real-time notification via WebSocket
   */
  async sendRealTimeNotification(recipientId, recipientType, notification) {
    try {
      if (!this.socketio) {
        logger.warn("Socket.IO not initialized for real-time notifications");
        return;
      }

      const roomName = `${recipientType}_${recipientId}`;

      this.socketio.to(roomName).emit("notification", {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        notificationType: notification.notificationType,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
        serviceRequestId: notification.serviceRequestId,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });

      logger.info(
        `Real-time notification sent to ${roomName}:`,
        notification.title,
      );
    } catch (error) {
      logger.error("Error sending real-time notification:", error);
    }
  }

  /**
   * Helper methods for common notification types
   */
  async notifyConsultationRequested(caId, serviceRequestId, userInfo) {
    return await this.createMultiChannelNotification(
      caId,
      "ca",
      "consultation_requested",
      "New Consultation Request",
      `${userInfo.name} has requested a consultation`,
      {
        serviceRequestId,
        actionUrl: `/ca/consultations/${serviceRequestId}`,
        actionText: "View Request",
        priority: "high",
        sendEmail: true,
        sendInApp: true,
        templateData: {
          userName: userInfo.name,
          userEmail: userInfo.email,
          purpose: userInfo.purpose || "",
          serviceRequestId,
        },
      },
    );
  }

  async notifyConsultationAccepted(userId, serviceRequestId, caInfo) {
    return await this.createMultiChannelNotification(
      userId,
      "user",
      "consultation_accepted",
      "Consultation Accepted",
      `CA ${caInfo.name} has accepted your consultation request`,
      {
        serviceRequestId,
        actionUrl: `/consultations/${serviceRequestId}`,
        actionText: "View Details",
        priority: "high",
        sendEmail: true,
        sendInApp: true,
        templateData: {
          caName: caInfo.name,
          caEmail: caInfo.email,
          serviceRequestId,
        },
      },
    );
  }

  async notifyPaymentSuccessful(userId, paymentInfo) {
    return await this.createMultiChannelNotification(
      userId,
      "user",
      "payment_successful",
      "Payment Successful",
      `Your payment of ₹${paymentInfo.amount} has been processed successfully`,
      {
        serviceRequestId: paymentInfo.serviceRequestId,
        actionUrl: `/payments/${paymentInfo.id}`,
        actionText: "View Receipt",
        priority: "medium",
        sendEmail: true,
        sendInApp: true,
        templateData: {
          amount: paymentInfo.amount,
          orderId: paymentInfo.orderId,
          paymentId: paymentInfo.id,
          serviceRequestId: paymentInfo.serviceRequestId,
          serviceName: paymentInfo.serviceName || "",
        },
      },
    );
  }

  async notifyDocumentUploaded(recipientId, recipientType, documentInfo) {
    return await this.createMultiChannelNotification(
      recipientId,
      recipientType,
      "document_uploaded",
      "New Document Uploaded",
      `A new document "${documentInfo.name}" has been uploaded`,
      {
        serviceRequestId: documentInfo.serviceRequestId,
        actionUrl: `/documents/${documentInfo.id}`,
        actionText: "View Document",
        priority: "medium",
        sendEmail: true,
        sendInApp: true,
        templateData: {
          documentName: documentInfo.name,
          uploaderName: documentInfo.uploaderName,
          uploaderType: documentInfo.uploaderType,
          serviceRequestId: documentInfo.serviceRequestId,
        },
      },
    );
  }

  async notifyMeetingScheduled(recipientId, recipientType, meetingInfo) {
    return await this.createMultiChannelNotification(
      recipientId,
      recipientType,
      "meeting_scheduled",
      "Meeting Scheduled",
      `A meeting has been scheduled for ${meetingInfo.scheduledDateTime}`,
      {
        serviceRequestId: meetingInfo.serviceRequestId,
        actionUrl: `/meetings/${meetingInfo.id}`,
        actionText: "Join Meeting",
        priority: "high",
        sendEmail: true,
        sendInApp: true,
        templateData: {
          scheduledDateTime: meetingInfo.scheduledDateTime,
          meetingUrl: meetingInfo.meetingUrl,
          otherPartyName: meetingInfo.otherPartyName,
          serviceRequestId: meetingInfo.serviceRequestId,
        },
      },
    );
  }
}

module.exports = new NotificationService();
