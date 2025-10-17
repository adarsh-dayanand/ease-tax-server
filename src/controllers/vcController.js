const vcSchedulingService = require("../services/vcSchedulingService");
const logger = require("../config/logger");

class VCController {
  /**
   * Schedule video call
   * POST /vc/schedule
   */
  async scheduleMeeting(req, res) {
    try {
      const {
        serviceRequestId,
        scheduledDateTime,
        duration = 30,
        provider = "zoom",
      } = req.body;

      if (!serviceRequestId || !scheduledDateTime) {
        return res.status(400).json({
          success: false,
          message: "Service request ID and scheduled date/time are required",
        });
      }

      const meeting = await vcSchedulingService.scheduleMeeting(
        serviceRequestId,
        scheduledDateTime,
        duration,
        provider
      );

      res.status(201).json({
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
   * PUT /vc/:meetingId/reschedule
   */
  async rescheduleMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const { scheduledDateTime } = req.body;

      if (!scheduledDateTime) {
        return res.status(400).json({
          success: false,
          message: "New scheduled date/time is required",
        });
      }

      const meeting = await vcSchedulingService.rescheduleMeeting(
        meetingId,
        scheduledDateTime
      );

      res.json({
        success: true,
        data: meeting,
        message: "Meeting rescheduled successfully",
      });
    } catch (error) {
      logger.error("Error in rescheduleMeeting:", error);

      if (error.message === "Meeting not found") {
        return res.status(404).json({
          success: false,
          message: "Meeting not found",
        });
      }

      res.status(400).json({
        success: false,
        message: error.message || "Failed to reschedule meeting",
      });
    }
  }

  /**
   * Get meeting status/details
   * GET /vc/:meetingId/status
   */
  async getMeetingStatus(req, res) {
    try {
      const { meetingId } = req.params;

      const meeting = await vcSchedulingService.getMeetingDetails(meetingId);

      res.json({
        success: true,
        data: meeting,
      });
    } catch (error) {
      logger.error("Error in getMeetingStatus:", error);

      if (error.message === "Meeting not found") {
        return res.status(404).json({
          success: false,
          message: "Meeting not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Cancel meeting
   * DELETE /vc/:meetingId
   */
  async cancelMeeting(req, res) {
    try {
      const { meetingId } = req.params;

      await vcSchedulingService.cancelMeeting(meetingId);

      res.json({
        success: true,
        message: "Meeting cancelled successfully",
      });
    } catch (error) {
      logger.error("Error in cancelMeeting:", error);

      if (error.message === "Meeting not found") {
        return res.status(404).json({
          success: false,
          message: "Meeting not found",
        });
      }

      res.status(400).json({
        success: false,
        message: error.message || "Failed to cancel meeting",
      });
    }
  }

  /**
   * Get available VC providers
   * GET /vc/providers
   */
  async getProviders(req, res) {
    try {
      const providers = vcSchedulingService.getAvailableProviders();

      res.json({
        success: true,
        data: providers,
      });
    } catch (error) {
      logger.error("Error in getProviders:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new VCController();
