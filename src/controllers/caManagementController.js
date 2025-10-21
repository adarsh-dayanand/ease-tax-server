const caManagementService = require("../services/caManagementService");
const notificationService = require("../services/notificationService");
const logger = require("../config/logger");

class CAManagementController {
  /**
   * Update estimated amount for a service request (CA only)
   * PATCH /ca-mgmt/requests/:requestId/estimated-amount
   */
  async updateEstimatedAmount(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;
      const { estimatedAmount } = req.body;
      if (!estimatedAmount) {
        return res.status(400).json({
          success: false,
          message: "estimatedAmount is required",
        });
      }
      const result = await caManagementService.updateEstimatedAmount(
        requestId,
        caId,
        estimatedAmount
      );
      res.json({
        success: true,
        data: result,
        message: "Estimated amount updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateEstimatedAmount:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update estimated amount",
      });
    }
  }
  /**
   * Get CA dashboard data
   * GET /ca-mgmt/dashboard
   */
  async getCADashboard(req, res) {
    try {
      const caId = req.user.id;
      const dashboard = await caManagementService.getCADashboard(caId);

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error("Error in getCADashboard:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get CA service requests
   * GET /ca-mgmt/requests
   */
  async getCARequests(req, res) {
    try {
      const caId = req.user.id;
      const { status, page = 1, limit = 10 } = req.query;

      const requests = await caManagementService.getCARequests(
        caId,
        status,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: requests.data,
        pagination: requests.pagination,
      });
    } catch (error) {
      logger.error("Error in getCARequests:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get specific request details
   * GET /ca-mgmt/requests/:requestId
   */
  async getRequestDetails(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;

      const request = await caManagementService.getRequestDetails(
        requestId,
        caId
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Request not found or access denied",
        });
      }

      res.json({
        success: true,
        data: request,
      });
    } catch (error) {
      logger.error("Error in getRequestDetails:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Accept service request
   * POST /ca-mgmt/requests/:requestId/accept
   */
  async acceptRequest(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;
      const { scheduledDate, scheduledTime, estimatedAmount, notes } = req.body;

      if (!scheduledDate || !scheduledTime || !estimatedAmount) {
        return res.status(400).json({
          success: false,
          message:
            "scheduledDate, scheduledTime, and estimatedAmount are required",
        });
      }

      const result = await caManagementService.acceptRequest(requestId, caId, {
        scheduledDate,
        scheduledTime,
        estimatedAmount,
        notes,
      });

      // Send notification to user
      await notificationService.notifyConsultationAccepted(
        result.userId,
        requestId,
        { name: req.user.name }
      );

      res.json({
        success: true,
        data: result,
        message: "Request accepted successfully",
      });
    } catch (error) {
      logger.error("Error in acceptRequest:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to accept request",
      });
    }
  }

  /**
   * Reject service request
   * POST /ca-mgmt/requests/:requestId/reject
   */
  async rejectRequest(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }

      const result = await caManagementService.rejectRequest(
        requestId,
        caId,
        reason
      );

      // Send notification to user
      await notificationService.createNotification(
        result.userId,
        "user",
        "consultation_rejected",
        "Consultation Request Rejected",
        `CA ${req.user.name} has rejected your consultation request. Reason: ${reason}`,
        {
          serviceRequestId: requestId,
          priority: "high",
          templateData: { caName: req.user.name, reason },
        }
      );

      res.json({
        success: true,
        data: result,
        message: "Request rejected",
      });
    } catch (error) {
      logger.error("Error in rejectRequest:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to reject request",
      });
    }
  }

  /**
   * Update request status
   * PUT /ca-mgmt/requests/:requestId/status
   */
  async updateRequestStatus(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;
      const { status, notes } = req.body;

      const validStatuses = [
        "in_progress",
        "documents_requested",
        "under_review",
        "clarification_needed",
        "processing",
        "filed",
        "completed",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid statuses: ${validStatuses.join(", ")}`,
        });
      }

      const result = await caManagementService.updateRequestStatus(
        requestId,
        caId,
        status,
        notes
      );

      // Send notification to user about status change
      await notificationService.createNotification(
        result.userId,
        "user",
        "consultation_status_updated",
        "Service Status Updated",
        `Your service status has been updated to: ${status.replace("_", " ").toUpperCase()}`,
        {
          serviceRequestId: requestId,
          actionUrl: `/consultations/${requestId}`,
          actionText: "View Details",
          priority: "medium",
          templateData: { status, notes },
        }
      );

      res.json({
        success: true,
        data: result,
        message: "Status updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateRequestStatus:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update status",
      });
    }
  }

  /**
   * Mark request as complete
   * POST /ca-mgmt/requests/:requestId/complete
   */
  async markRequestComplete(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;
      const { completionNotes, deliverables } = req.body;

      const result = await caManagementService.markRequestComplete(
        requestId,
        caId,
        {
          completionNotes,
          deliverables,
        }
      );

      // Send notification to user
      await notificationService.createNotification(
        result.userId,
        "user",
        "consultation_completed",
        "Service Completed",
        `Your service has been completed by CA ${req.user.name}. Please make the final payment to access your documents.`,
        {
          serviceRequestId: requestId,
          actionUrl: `/consultations/${requestId}/payment`,
          actionText: "Make Payment",
          priority: "high",
          templateData: { caName: req.user.name, completionNotes },
        }
      );

      res.json({
        success: true,
        data: result,
        message: "Request marked as complete",
      });
    } catch (error) {
      logger.error("Error in markRequestComplete:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to mark request as complete",
      });
    }
  }

  /**
   * Get CA profile
   * GET /ca-mgmt/profile
   */
  async getProfile(req, res) {
    try {
      const caId = req.user.id;
      const profile = await caManagementService.getCAProfile(caId);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      logger.error("Error in getProfile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update CA profile
   * PUT /ca-mgmt/profile
   */
  async updateProfile(req, res) {
    try {
      const caId = req.user.id;
      const updateData = req.body;

      const profile = await caManagementService.updateCAProfile(
        caId,
        updateData
      );

      res.json({
        success: true,
        data: profile,
        message: "Profile updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateProfile:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update profile",
      });
    }
  }

  /**
   * Schedule meeting for service request
   * POST /ca-mgmt/requests/:requestId/schedule-meeting
   */
  async scheduleMeeting(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;
      const { scheduledDateTime, duration, meetingType, agenda } = req.body;

      if (!scheduledDateTime || !duration) {
        return res.status(400).json({
          success: false,
          message: "Scheduled date/time and duration are required",
        });
      }

      const meeting = await caManagementService.scheduleMeeting(
        requestId,
        caId,
        {
          scheduledDateTime,
          duration,
          meetingType: meetingType || "google_meet",
          agenda,
        }
      );

      // Send notification to user
      await notificationService.notifyMeetingScheduled(meeting.userId, "user", {
        id: meeting.id,
        serviceRequestId: requestId,
        scheduledDateTime,
        meetingUrl: meeting.meetingUrl,
      });

      res.json({
        success: true,
        data: meeting,
        message: "Meeting scheduled successfully",
      });
    } catch (error) {
      logger.error("Error in scheduleMeeting:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to schedule meeting",
      });
    }
  }

  /**
   * Reschedule meeting
   * PUT /ca-mgmt/meetings/:meetingId/reschedule
   */
  async rescheduleMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const caId = req.user.id;
      const { newScheduledDateTime, reason } = req.body;

      if (!newScheduledDateTime || !reason) {
        return res.status(400).json({
          success: false,
          message: "New date/time and reason are required",
        });
      }

      const meeting = await caManagementService.rescheduleMeeting(
        meetingId,
        caId,
        {
          newScheduledDateTime,
          reason,
        }
      );

      // Send notification to user
      await notificationService.createNotification(
        meeting.userId,
        "user",
        "meeting_rescheduled",
        "Meeting Rescheduled",
        `Your meeting has been rescheduled to ${newScheduledDateTime}. Reason: ${reason}`,
        {
          serviceRequestId: meeting.serviceRequestId,
          actionUrl: `/meetings/${meetingId}`,
          actionText: "View Meeting",
          priority: "high",
          templateData: {
            newDateTime: newScheduledDateTime,
            reason,
            meetingUrl: meeting.meetingUrl,
          },
        }
      );

      res.json({
        success: true,
        data: meeting,
        message: "Meeting rescheduled successfully",
      });
    } catch (error) {
      logger.error("Error in rescheduleMeeting:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to reschedule meeting",
      });
    }
  }

  /**
   * Upload ITR-V document
   * POST /ca-mgmt/requests/:requestId/upload-itr-v
   */
  async uploadITRVDocument(req, res) {
    try {
      const { requestId } = req.params;
      const caId = req.user.id;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const documentService = require("../services/documentService");
      const document = await documentService.uploadITRVDocument(
        req.file,
        requestId,
        caId
      );

      // Send notification to user
      await notificationService.createNotification(
        req.user.id, // This should be the user ID, need to get from service request
        "user",
        "document_uploaded",
        "ITR-V Ready for Download",
        "Your ITR-V document is ready. Please complete the final payment to download.",
        {
          serviceRequestId: requestId,
          actionUrl: `/consultations/${requestId}/payment`,
          actionText: "Make Payment",
          priority: "high",
          templateData: { documentName: document.name },
        }
      );

      res.status(201).json({
        success: true,
        data: document,
        message: "ITR-V document uploaded successfully",
      });
    } catch (error) {
      logger.error("Error in uploadITRVDocument:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to upload ITR-V document",
      });
    }
  }
}

module.exports = new CAManagementController();
