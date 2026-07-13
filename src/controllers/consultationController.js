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

      const consultation = await consultationService.getConsultationDetails(
        consultationId,
        userId,
      );

      if (!consultation) {
        return res.status(404).json({
          success: false,
          message: "Consultation not found",
        });
      }

      res.json({
        success: true,
        data: consultation,
      });
    } catch (error) {
      logger.error("Error in getConsultationDetails:", error);
      if (error.message === "Consultation not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === "Access denied") {
        return res.status(403).json({ success: false, message: error.message });
      }
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
        reason,
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
      const userId = req.user.id;

      const messages = await consultationService.getConsultationMessages(
        consultationId,
        userId,
        parseInt(page),
        parseInt(limit),
      );

      res.json({
        success: true,
        data: messages.data,
        pagination: messages.pagination,
      });
    } catch (error) {
      logger.error("Error in getConsultationMessages:", error);
      if (error.message === "Consultation not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === "Access denied") {
        return res.status(403).json({ success: false, message: error.message });
      }
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
        attachmentUrl,
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
        userId,
      );

      // Set cache control headers to prevent browser caching
      // This ensures deleted documents don't appear due to browser cache
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      res.json({
        success: true,
        data: documents,
      });
    } catch (error) {
      logger.error("Error in getConsultationDocuments:", error);

      if (error.message?.includes("Access denied")) {
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
        "accepted",
        "rejected",
        "in_progress",
        "completed",
        "cancelled",
        "escalated",
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
        userId,
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

      const { ServiceRequest, Payment } = require("../../models");
      const { Op } = require("sequelize");

      // Get analytics data
      // Revenue comes from actual completed Payment records — ServiceRequest
      // has no stored amount column (service price lives on CAService and
      // is only realized once a Payment is made).
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
        Payment.sum("amount", {
          where: {
            status: "completed",
            paymentType: { [Op.in]: ["booking_fee", "service_fee"] },
          },
        }),
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
