const {
  ServiceRequest,
  User,
  CA,
  Payment,
  CAService,
  Message,
  Review,
} = require("../../models");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class ConsultationService {
  /**
   * Book a new consultation
   */
  async bookConsultation(userId, bookingData) {
    try {
      const { caServiceId, purpose, additionalNotes } = bookingData;

      // Validate CA Service exists
      const caService =
        await require("../../models").CAService.findByPk(caServiceId);
      if (!caService) {
        throw new Error("CA Service not found");
      }

      // Check for existing consultation for the same user and CA service
      const existingConsultation = await ServiceRequest.findOne({
        where: {
          userId,
          caServiceId,
          status: { [Op.in]: ["pending", "accepted", "in_progress"] },
        },
      });

      if (existingConsultation) {
        throw new Error(
          "You already have an active consultation for this service",
        );
      }

      // Create service request (pending, no schedule yet)
      const consultation = await ServiceRequest.create({
        userId,
        caId: caService.caId, // CA will be assigned only after acceptance
        caServiceId,
        purpose,
        additionalNotes,
        status: "pending",
        metadata: {
          requestedAt: new Date(),
        },
      });

      // Notify the CA about the new request
      const notificationService = require("./notificationService");
      const user = await User.findByPk(userId);
      await notificationService.notifyConsultationRequested(
        caService.caId,
        consultation.id,
        {
          name: user ? user.name : "Client",
          email: user ? user.email : "",
          purpose: purpose || "",
        },
      );

      return await this.getConsultationDetails(consultation.id);
    } catch (error) {
      logger.error("Error booking consultation:", error);
      throw error;
    }
  }

  /**
   * Get consultation details with caching
   */
  async getConsultationDetails(consultationId) {
    try {
      const serviceRequest = await ServiceRequest.findByPk(consultationId, {
        include: [
          {
            model: CA,
            as: "ca",
            attributes: ["id", "name", "profileImage"],
          },
          {
            model: CAService,
            as: "caService",
            attributes: ["customPrice", "currency", "experienceLevel"],
          },
          {
            model: Payment,
            as: "payments",
            attributes: ["id", "amount", "status", "paymentType"],
          },
        ],
      });

      if (!serviceRequest) {
        throw new Error("Consultation not found");
      }

      let consultation;
      const servicePrice = serviceRequest.caService?.customPrice
        ? parseFloat(serviceRequest.caService.customPrice)
        : null;

      // Calculate payment status based on booking_fee and service_fee payments
      const bookingPayment = serviceRequest.payments?.find(
        (p) => p.paymentType === "booking_fee",
      );
      const servicePayment = serviceRequest.payments?.find(
        (p) => p.paymentType === "service_fee",
      );

      let paymentStatus = "unpaid";
      if (bookingPayment && bookingPayment.status === "completed") {
        if (servicePayment && servicePayment.status === "completed") {
          paymentStatus = "paid"; // Both payments completed
        } else {
          paymentStatus = "token-paid"; // Only booking fee paid
        }
      }

      // Check if user has already reviewed this service
      const existingReview = await Review.findOne({
        where: {
          serviceRequestId: serviceRequest.id,
          userId: serviceRequest.userId,
          caId: serviceRequest.caId,
        },
      });

      consultation = {
        id: serviceRequest.id,
        caId: serviceRequest.caId,
        caName: serviceRequest.ca?.name || "CA Name",
        caImage: serviceRequest.ca?.profileImage,
        type: "video", // Default consultation type
        purpose: serviceRequest.purpose,
        status: serviceRequest.status,
        paymentStatus: paymentStatus,
        durationMinutes: 30, // Default duration
        experienceLevel: serviceRequest.caService?.experienceLevel,
        currency: serviceRequest?.caService?.currency || "INR",
        // Service price from CAService.customPrice
        servicePrice: servicePrice, // The base service price from CAService.customPrice
        price: servicePrice, // For backward compatibility
        notes: serviceRequest.additionalNotes,
        progress: this.calculateProgress(serviceRequest.status),
        createdAt: serviceRequest.createdAt,
        updatedAt: serviceRequest.updatedAt,
        meetingLink: serviceRequest.metadata?.meetingLink,
        itrNumber: serviceRequest.metadata?.itrNumber,
        acknowledgmentNumber: serviceRequest.metadata?.acknowledgmentNumber,
        hasReviewed: !!existingReview,
      };

      return consultation;
    } catch (error) {
      logger.error("Error getting consultation details:", error);
      throw error;
    }
  }

  /**
   * Cancel consultation
   */
  async cancelConsultation(consultationId, userId, reason) {
    try {
      const consultation = await ServiceRequest.findByPk(consultationId);

      if (!consultation) {
        throw new Error("Consultation not found");
      }

      // Check user access
      if (consultation.userId !== userId && consultation.caId !== userId) {
        throw new Error("Access denied");
      }

      // Check if consultation can be cancelled
      if (["completed", "cancelled"].includes(consultation.status)) {
        throw new Error("Consultation cannot be cancelled at this stage");
      }

      // Calculate refund based on cancellation policy
      const refundAmount = this.calculateRefund(consultation);

      // Update consultation
      await consultation.update({
        status: "cancelled",
        cancellationReason: reason,
        metadata: {
          ...consultation.metadata,
          refundAmount,
          cancelledAt: new Date(),
        },
      });

      return {
        success: true,
        refundAmount,
        message: "Consultation cancelled successfully",
      };
    } catch (error) {
      logger.error("Error cancelling consultation:", error);
      throw error;
    }
  }

  /**
   * Get consultation messages with caching
   */
  async getConsultationMessages(consultationId, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      const { rows, count } = await Message.findAndCountAll({
        where: { serviceRequestId: consultationId },
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
      logger.error("Error getting consultation messages:", error);
      throw error;
    }
  }

  /**
   * Send message
   */
  async sendMessage(
    consultationId,
    senderId,
    messageContent,
    attachmentUrl = null,
  ) {
    try {
      const consultation = await ServiceRequest.findByPk(consultationId);

      if (!consultation) {
        throw new Error("Consultation not found");
      }

      // Check user access
      if (consultation.userId !== senderId && consultation.caId !== senderId) {
        throw new Error("Access denied");
      }

      const message = await Message.create({
        serviceRequestId: consultationId,
        senderId,
        senderType: consultation.userId === senderId ? "user" : "ca",
        receiverId:
          consultation.userId === senderId
            ? consultation.caId
            : consultation.userId,
        receiverType: consultation.userId === senderId ? "ca" : "user",
        content: messageContent,
        attachmentUrl,
        attachmentType: attachmentUrl ? this.getFileType(attachmentUrl) : null,
      });

      // Fetch the created message with sender info
      const messageWithSender = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: "senderUser",
            attributes: ["id", "name", "profileImage"],
          },
          {
            model: CA,
            as: "senderCA",
            attributes: ["id", "name", "profileImage"],
          },
        ],
      });

      return {
        id: messageWithSender.id,
        serviceRequestId: consultationId,
        senderId: messageWithSender.senderId,
        senderType: messageWithSender.senderType,
        senderName:
          messageWithSender.senderUser?.name ||
          messageWithSender.senderCA?.name,
        senderAvatar:
          messageWithSender.senderUser?.profileImage ||
          messageWithSender.senderCA?.profileImage,
        receiverId: messageWithSender.receiverId,
        receiverType: messageWithSender.receiverType,
        messageType: messageWithSender.messageType || "text",
        content: messageWithSender.content,
        attachmentUrl: messageWithSender.attachmentUrl,
        attachmentType: messageWithSender.attachmentType,
        attachmentName: messageWithSender.attachmentName,
        timestamp: messageWithSender.createdAt,
        isDelivered: messageWithSender.isDelivered,
        isRead: messageWithSender.isRead,
        hasAttachment: !!messageWithSender.attachmentUrl,
      };
    } catch (error) {
      logger.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get consultation documents with caching and access control
   */
  async getConsultationDocuments(consultationId, requestingUserId) {
    try {
      const documentService = require("./documentService");
      return await documentService.getServiceRequestDocuments(
        consultationId,
        requestingUserId,
      );
    } catch (error) {
      logger.error("Error getting consultation documents:", error);
      throw error;
    }
  }

  /**
   * Update consultation status
   */
  async updateConsultationStatus(consultationId, status, updatedBy) {
    try {
      const consultation = await ServiceRequest.findByPk(consultationId);

      if (!consultation) {
        throw new Error("Consultation not found");
      }

      await consultation.update({
        status,
        metadata: {
          ...consultation.metadata,
          lastUpdatedBy: updatedBy,
          statusUpdatedAt: new Date(),
        },
      });

      return await this.getConsultationDetails(consultationId);
    } catch (error) {
      logger.error("Error updating consultation status:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  calculateProgress(status) {
    const progressMap = {
      pending: 10,
      accepted: 20,
      in_progress: 50,
      completed: 100,
      cancelled: 0,
      rejected: 0,
      escalated: 25,
    };

    return progressMap[status] || 0;
  }

  calculateRefund(consultation) {
    const { status, estimatedAmount, finalAmount } = consultation;
    const amount = finalAmount || estimatedAmount || 0;

    if (["pending"].includes(status)) {
      return amount; // Full refund
    } else if (["accepted"].includes(status)) {
      return amount * 0.5; // 50% refund
    } else {
      return 0; // No refund
    }
  }

  formatTimestamp(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffTime = Math.abs(now - messageDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    return messageDate.toLocaleDateString();
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  getFileType(url) {
    const extension = url.split(".").pop().toLowerCase();
    const imageTypes = ["jpg", "jpeg", "png", "gif", "bmp"];
    const documentTypes = ["pdf", "doc", "docx", "xls", "xlsx"];

    if (imageTypes.includes(extension)) return "image";
    if (documentTypes.includes(extension)) return "document";
    return "file";
  }

  /**
   * Clear consultation related cache
   */
  async clearConsultationCache(consultationId) {
    // No-op - cache removed
  }
}

module.exports = new ConsultationService();
