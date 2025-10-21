const consultationService = require("../services/consultationService");
const logger = require("../config/logger");

class ConsultationController {
  /**
   * Book a new consultation
   * POST /users/consultations
   */
  async bookConsultation(req, res) {
    try {
      const userId = req.user.id;
      const bookingData = req.body;

      // Validate required fields
      const { caServiceId, purpose, additionalNotes } = bookingData;
      if (!caServiceId || !purpose) {
        return res.status(400).json({
          success: false,
          message: "caServiceId and purpose are required",
        });
      }

      const consultation = await consultationService.bookConsultation(userId, {
        caServiceId,
        purpose,
        additionalNotes,
      });

      res.status(201).json({
        success: true,
        data: consultation,
        message: "Consultation booked successfully",
      });
    } catch (error) {
      logger.error("Error in bookConsultation:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to book consultation",
      });
    }
  }

  /**
   * Get consultation details
   * GET /consultations/:consultationId
   */
  async getConsultationDetails(req, res) {
    try {
      const { consultationId } = req.params;
      const userId = req.user.id;

      const consultation =
        await consultationService.getConsultationDetails(consultationId);

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: "Consultation not found",
        });
      }

      // Check access permissions (user can only see their own consultations)
      // This would require fetching the consultation's userId from the service
      // For now, we'll assume the service handles access control

      res.json({
        success: true,
        data: consultation,
      });
    } catch (error) {
      logger.error("Error in getConsultationDetails:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Cancel consultation
   * POST /consultations/:consultationId/cancel
   */
  async cancelConsultation(req, res) {
    try {
      const { consultationId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const result = await consultationService.cancelConsultation(
        consultationId,
        userId,
        reason
      );

      res.json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      logger.error("Error in cancelConsultation:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to cancel consultation",
      });
    }
  }

  /**
   * Get consultation messages
   * GET /consultations/:consultationId/messages
   */
  async getConsultationMessages(req, res) {
    try {
      const { consultationId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const messages = await consultationService.getConsultationMessages(
        consultationId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: messages.data,
        pagination: messages.pagination,
      });
    } catch (error) {
      logger.error("Error in getConsultationMessages:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Send message
   * POST /consultations/:consultationId/messages
   */
  async sendMessage(req, res) {
    try {
      const { consultationId } = req.params;
      const { message, attachmentUrl } = req.body;
      const senderId = req.user.id;

      if (!message && !attachmentUrl) {
        return res.status(400).json({
          success: false,
          message: "Message content or attachment is required",
        });
      }

      const sentMessage = await consultationService.sendMessage(
        consultationId,
        senderId,
        message,
        attachmentUrl
      );

      res.status(201).json({
        success: true,
        data: sentMessage,
        message: "Message sent successfully",
      });
    } catch (error) {
      logger.error("Error in sendMessage:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to send message",
      });
    }
  }

  /**
   * Get consultation documents
   * GET /consultations/:consultationId/documents
   */
  async getConsultationDocuments(req, res) {
    try {
      const { consultationId } = req.params;
      const userId = req.user.id;

      const documents = await consultationService.getConsultationDocuments(
        consultationId,
        userId
      );

      res.json({
        success: true,
        data: documents,
      });
    } catch (error) {
      logger.error("Error in getConsultationDocuments:", error);

      if (error.message.includes("Access denied")) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update consultation status (CA only)
   * PUT /consultations/:consultationId/status
   */
  async updateConsultationStatus(req, res) {
    try {
      const { consultationId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      // Validate status
      const validStatuses = [
        "pending",
        "ca-assigned",
        "documents-requested",
        "documents-uploaded",
        "under-review",
        "clarification-needed",
        "processing",
        "filed",
        "completed",
        "cancelled",
        "rejected",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      const consultation = await consultationService.updateConsultationStatus(
        consultationId,
        status,
        userId
      );

      res.json({
        success: true,
        data: consultation,
        message: "Consultation status updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateConsultationStatus:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update consultation status",
      });
    }
  }

  /**
   * Get consultation analytics (admin only)
   * GET /consultations/analytics
   */
  async getConsultationAnalytics(req, res) {
    try {
      // Only admin can access analytics
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const { ServiceRequest } = require("../../models");
      const { Op } = require("sequelize");

      // Get analytics data
      const [
        totalConsultations,
        pendingConsultations,
        completedConsultations,
        cancelledConsultations,
        revenueData,
      ] = await Promise.all([
        ServiceRequest.count(),
        ServiceRequest.count({ where: { status: "pending" } }),
        ServiceRequest.count({ where: { status: "completed" } }),
        ServiceRequest.count({ where: { status: "cancelled" } }),
        ServiceRequest.sum("totalAmount", { where: { status: "completed" } }),
      ]);

      const analytics = {
        totalConsultations,
        pendingConsultations,
        completedConsultations,
        cancelledConsultations,
        completionRate:
          totalConsultations > 0
            ? ((completedConsultations / totalConsultations) * 100).toFixed(2)
            : 0,
        cancellationRate:
          totalConsultations > 0
            ? ((cancelledConsultations / totalConsultations) * 100).toFixed(2)
            : 0,
        totalRevenue: revenueData || 0,
      };

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error("Error in getConsultationAnalytics:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new ConsultationController();
