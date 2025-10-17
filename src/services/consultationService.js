const {
  ServiceRequest,
  User,
  CA,
  Payment,
  Document,
  Message,
} = require("../../models");
const cacheService = require("./cacheService");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class ConsultationService {
  /**
   * Book a new consultation
   */
  async bookConsultation(userId, bookingData) {
    try {
      const { ca_id, date, time, purpose, additional_notes } = bookingData;

      // Validate CA exists and is available
      const ca = await CA.findOne({
        where: { id: ca_id, verified: true },
      });

      if (!ca) {
        throw new Error("CA not found or not available");
      }

      // Check if the time slot is available
      const existingBooking = await ServiceRequest.findOne({
        where: {
          caId: ca_id,
          scheduledDate: date,
          scheduledTime: time,
          status: { [Op.notIn]: ["cancelled", "rejected"] },
        },
      });

      if (existingBooking) {
        throw new Error("Time slot is already booked");
      }

      // Create service request - DO NOT assign CA until they accept
      const consultation = await ServiceRequest.create({
        userId,
        caId: null, // CA will be assigned only after acceptance
        scheduledDate: date,
        scheduledTime: time,
        purpose,
        additionalNotes: additional_notes,
        status: "pending",
        serviceType: "consultation",
        estimatedAmount: 2500, // Default consultation fee
        priority: "medium",
        metadata: {
          requestedCAId: ca_id, // Track which CA was requested
          requestedAt: new Date(),
        },
      });

      // Notify the requested CA about the new request
      const notificationService = require("./notificationService");
      await notificationService.notifyConsultationRequested(
        ca_id,
        consultation.id,
        { name: "User" } // We'll get user info if needed
      );

      // Clear related caches
      await this.clearConsultationCache(consultation.id);
      await cacheService.delPattern(`user:consultations:${userId}`);

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
      const cacheKey = cacheService.getCacheKeys().CONSULTATION(consultationId);

      let consultation = await cacheService.get(cacheKey);

      if (!consultation) {
        const serviceRequest = await ServiceRequest.findByPk(consultationId, {
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "email", "profileImage"],
            },
            {
              model: CA,
              as: "ca",
              attributes: [
                "id",
                "name",
                "image",
                "location",
                "completedFilings",
                "verified",
              ],
              include: [
                {
                  model: require("../../models").CASpecialization,
                  as: "specializations",
                  attributes: ["name"],
                },
              ],
            },
            {
              model: Payment,
              as: "payments",
            },
          ],
        });

        if (!serviceRequest) {
          return null;
        }

        consultation = {
          id: serviceRequest.id,
          caName: serviceRequest.ca?.name || "CA Name",
          caImage: serviceRequest.ca?.image,
          caSpecialization:
            serviceRequest.ca?.specializations?.[0]?.name || "Tax Consultant",
          date: serviceRequest.scheduledDate,
          time: serviceRequest.scheduledTime,
          type: "video", // Default consultation type
          purpose: serviceRequest.purpose,
          status: serviceRequest.status,
          paymentStatus:
            serviceRequest.payments?.length > 0
              ? serviceRequest.payments[0].status
              : "unpaid",
          durationMinutes: 30, // Default duration
          price: serviceRequest.estimatedAmount || serviceRequest.finalAmount,
          currency: "INR",
          notes: serviceRequest.additionalNotes,
          progress: this.calculateProgress(serviceRequest.status),
          createdAt: serviceRequest.createdAt,
          updatedAt: serviceRequest.updatedAt,
          meetingLink: serviceRequest.metadata?.meetingLink,
          itrNumber: serviceRequest.metadata?.itrNumber,
          acknowledgmentNumber: serviceRequest.metadata?.acknowledgmentNumber,
        };

        // Cache for 15 minutes
        await cacheService.set(cacheKey, consultation, 900);
      }

      return consultation;
    } catch (error) {
      logger.error("Error getting consultation details:", error);
      throw error;
    }
  }

  /**
   * Reschedule consultation
   */
  async rescheduleConsultation(consultationId, userId, newDate, newTime) {
    try {
      const consultation = await ServiceRequest.findByPk(consultationId);

      if (!consultation) {
        throw new Error("Consultation not found");
      }

      // Check user access
      if (consultation.userId !== userId && consultation.caId !== userId) {
        throw new Error("Access denied");
      }

      // Check if consultation can be rescheduled
      if (!["pending", "accepted"].includes(consultation.status)) {
        throw new Error("Consultation cannot be rescheduled at this stage");
      }

      // Check if new time slot is available
      const existingBooking = await ServiceRequest.findOne({
        where: {
          caId: consultation.caId,
          scheduledDate: newDate,
          scheduledTime: newTime,
          status: { [Op.notIn]: ["cancelled", "rejected"] },
          id: { [Op.ne]: consultationId },
        },
      });

      if (existingBooking) {
        throw new Error("New time slot is already booked");
      }

      // Update consultation
      await consultation.update({
        scheduledDate: newDate,
        scheduledTime: newTime,
        status: "pending", // Reset to pending for CA to re-confirm
      });

      // Clear cache
      await this.clearConsultationCache(consultationId);

      return await this.getConsultationDetails(consultationId);
    } catch (error) {
      logger.error("Error rescheduling consultation:", error);
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

      // Clear cache
      await this.clearConsultationCache(consultationId);

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
      const cacheKey = cacheService
        .getCacheKeys()
        .CONSULTATION_MESSAGES(consultationId);

      let messages = await cacheService.get(cacheKey);

      if (!messages) {
        const offset = (page - 1) * limit;

        const { rows, count } = await Message.findAndCountAll({
          where: { serviceRequestId: consultationId },
          limit,
          offset,
          order: [["createdAt", "ASC"]],
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "name", "profileImage"],
            },
          ],
        });

        messages = {
          data: rows.map((message) => ({
            id: message.id,
            sender: message.senderId === consultation.userId ? "user" : "ca",
            senderName: message.sender?.name,
            senderProfileImage: message.sender?.profileImage,
            message: message.content,
            timestamp: this.formatTimestamp(message.createdAt),
            hasAttachment: !!message.attachmentUrl,
            attachmentUrl: message.attachmentUrl,
            attachmentType: message.attachmentType,
          })),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        };

        // Cache for 5 minutes (messages are dynamic)
        await cacheService.set(cacheKey, messages, 300);
      }

      return messages;
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
    attachmentUrl = null
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
        content: messageContent,
        attachmentUrl,
        attachmentType: attachmentUrl ? this.getFileType(attachmentUrl) : null,
      });

      // Clear messages cache
      const cacheKey = cacheService
        .getCacheKeys()
        .CONSULTATION_MESSAGES(consultationId);
      await cacheService.del(cacheKey);

      return {
        id: message.id,
        sender: senderId === consultation.userId ? "user" : "ca",
        message: message.content,
        timestamp: this.formatTimestamp(message.createdAt),
        hasAttachment: !!message.attachmentUrl,
        attachmentUrl: message.attachmentUrl,
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
        requestingUserId
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

      // Clear cache
      await this.clearConsultationCache(consultationId);

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
    try {
      const keys = cacheService.getCacheKeys();
      await Promise.all([
        cacheService.del(keys.CONSULTATION(consultationId)),
        cacheService.del(keys.CONSULTATION_MESSAGES(consultationId)),
        cacheService.del(keys.CONSULTATION_DOCUMENTS(consultationId)),
      ]);
    } catch (error) {
      logger.error("Error clearing consultation cache:", error);
    }
  }
}

module.exports = new ConsultationService();
