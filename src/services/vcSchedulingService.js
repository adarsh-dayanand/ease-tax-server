const { Meeting, ServiceRequest, User } = require("../../models");
const logger = require("../config/logger");
const crypto = require("crypto");

class VCSchedulingService {
  constructor() {
    // Configure third-party VC providers
    this.providers = {
      zoom: {
        enabled: !!process.env.ZOOM_API_KEY,
        apiKey: process.env.ZOOM_API_KEY,
        apiSecret: process.env.ZOOM_API_SECRET,
      },
      googleMeet: {
        enabled: !!process.env.GOOGLE_MEET_CLIENT_ID,
        clientId: process.env.GOOGLE_MEET_CLIENT_ID,
        clientSecret: process.env.GOOGLE_MEET_CLIENT_SECRET,
      },
      teams: {
        enabled: !!process.env.TEAMS_CLIENT_ID,
        clientId: process.env.TEAMS_CLIENT_ID,
        clientSecret: process.env.TEAMS_CLIENT_SECRET,
      },
    };

    this.mockMode = process.env.NODE_ENV === "development";
  }

  /**
   * Schedule video call meeting
   */
  async scheduleMeeting(
    serviceRequestId,
    scheduledDateTime,
    duration = 30,
    provider = "zoom"
  ) {
    try {
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
          {
            model: require("../../models").CA,
            as: "ca",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      if (!serviceRequest) {
        throw new Error("Service request not found");
      }

      // Check if meeting already exists
      const existingMeeting = await Meeting.findOne({
        where: { serviceRequestId },
      });

      if (existingMeeting && existingMeeting.status !== "cancelled") {
        return await this.getMeetingDetails(existingMeeting.id);
      }

      let meetingData;

      if (this.mockMode || !this.providers[provider]?.enabled) {
        meetingData = await this.createMockMeeting(
          serviceRequest,
          scheduledDateTime,
          duration
        );
      } else {
        switch (provider) {
          case "zoom":
            meetingData = await this.createZoomMeeting(
              serviceRequest,
              scheduledDateTime,
              duration
            );
            break;
          case "googleMeet":
            meetingData = await this.createGoogleMeetMeeting(
              serviceRequest,
              scheduledDateTime,
              duration
            );
            break;
          case "teams":
            meetingData = await this.createTeamsMeeting(
              serviceRequest,
              scheduledDateTime,
              duration
            );
            break;
          default:
            throw new Error("Unsupported VC provider");
        }
      }

      // Save meeting details
      const meeting = await Meeting.create({
        serviceRequestId,
        provider,
        meetingId: meetingData.id,
        joinUrl: meetingData.joinUrl,
        startUrl: meetingData.startUrl,
        password: meetingData.password,
        scheduledDateTime,
        duration,
        status: "scheduled",
        attendees: JSON.stringify([
          {
            email: serviceRequest.user.email,
            name: serviceRequest.user.name,
            role: "attendee",
          },
          {
            email: serviceRequest.ca.email,
            name: serviceRequest.ca.name,
            role: "host",
          },
        ]),
        metadata: meetingData.metadata,
      });

      // Update service request with meeting link
      await serviceRequest.update({
        meetingId: meeting.id,
        meetingLink: meetingData.joinUrl,
      });

      return {
        id: meeting.id,
        meetingId: meeting.meetingId,
        joinUrl: meeting.joinUrl,
        startUrl: meeting.startUrl,
        password: meeting.password,
        scheduledDateTime: meeting.scheduledDateTime,
        duration: meeting.duration,
        provider: meeting.provider,
        status: meeting.status,
      };
    } catch (error) {
      logger.error("Error scheduling meeting:", error);
      throw error;
    }
  }

  /**
   * Reschedule meeting
   */
  async rescheduleMeeting(meetingId, newDateTime) {
    try {
      const meeting = await Meeting.findByPk(meetingId, {
        include: [
          {
            model: ServiceRequest,
            as: "serviceRequest",
            include: [
              { model: User, as: "user" },
              { model: require("../../models").CA, as: "ca" },
            ],
          },
        ],
      });

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      let updatedMeetingData;

      if (this.mockMode || !this.providers[meeting.provider]?.enabled) {
        updatedMeetingData = {
          id: meeting.meetingId,
          scheduledDateTime: newDateTime,
          joinUrl: meeting.joinUrl,
        };
      } else {
        // Update meeting with respective provider
        switch (meeting.provider) {
          case "zoom":
            updatedMeetingData = await this.updateZoomMeeting(
              meeting.meetingId,
              newDateTime
            );
            break;
          case "googleMeet":
            updatedMeetingData = await this.updateGoogleMeetMeeting(
              meeting.meetingId,
              newDateTime
            );
            break;
          case "teams":
            updatedMeetingData = await this.updateTeamsMeeting(
              meeting.meetingId,
              newDateTime
            );
            break;
          default:
            throw new Error("Unsupported VC provider");
        }
      }

      await meeting.update({
        scheduledDateTime: newDateTime,
        status: "rescheduled",
      });

      return await this.getMeetingDetails(meetingId);
    } catch (error) {
      logger.error("Error rescheduling meeting:", error);
      throw error;
    }
  }

  /**
   * Get meeting details
   */
  async getMeetingDetails(meetingId) {
    try {
      const meeting = await Meeting.findByPk(meetingId);

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      return {
        id: meeting.id,
        meetingId: meeting.meetingId,
        joinUrl: meeting.joinUrl,
        startUrl: meeting.startUrl,
        password: meeting.password,
        scheduledDateTime: meeting.scheduledDateTime,
        duration: meeting.duration,
        provider: meeting.provider,
        status: meeting.status,
        attendees: JSON.parse(meeting.attendees || "[]"),
      };
    } catch (error) {
      logger.error("Error getting meeting details:", error);
      throw error;
    }
  }

  /**
   * Cancel meeting
   */
  async cancelMeeting(meetingId) {
    try {
      const meeting = await Meeting.findByPk(meetingId);

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      if (!this.mockMode && this.providers[meeting.provider]?.enabled) {
        // Cancel meeting with respective provider
        switch (meeting.provider) {
          case "zoom":
            await this.cancelZoomMeeting(meeting.meetingId);
            break;
          case "googleMeet":
            await this.cancelGoogleMeetMeeting(meeting.meetingId);
            break;
          case "teams":
            await this.cancelTeamsMeeting(meeting.meetingId);
            break;
        }
      }

      await meeting.update({ status: "cancelled" });

      return true;
    } catch (error) {
      logger.error("Error cancelling meeting:", error);
      throw error;
    }
  }

  /**
   * Mock meeting creation for development
   */
  async createMockMeeting(serviceRequest, scheduledDateTime, duration) {
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockPassword = Math.random().toString(36).substr(2, 8);

    return {
      id: mockId,
      joinUrl: `https://mock-vc.easetax.com/join/${mockId}`,
      startUrl: `https://mock-vc.easetax.com/start/${mockId}`,
      password: mockPassword,
      metadata: {
        mock: true,
        topic: `ITR Consultation - ${serviceRequest.user.name} & ${serviceRequest.ca.name}`,
        scheduledDateTime,
        duration,
      },
    };
  }

  /**
   * Zoom integration methods (placeholder)
   */
  async createZoomMeeting(serviceRequest, scheduledDateTime, duration) {
    // Real Zoom API integration would go here
    throw new Error("Zoom integration not implemented");
  }

  async updateZoomMeeting(meetingId, newDateTime) {
    throw new Error("Zoom integration not implemented");
  }

  async cancelZoomMeeting(meetingId) {
    throw new Error("Zoom integration not implemented");
  }

  /**
   * Google Meet integration methods (placeholder)
   */
  async createGoogleMeetMeeting(serviceRequest, scheduledDateTime, duration) {
    throw new Error("Google Meet integration not implemented");
  }

  async updateGoogleMeetMeeting(meetingId, newDateTime) {
    throw new Error("Google Meet integration not implemented");
  }

  async cancelGoogleMeetMeeting(meetingId) {
    throw new Error("Google Meet integration not implemented");
  }

  /**
   * Teams integration methods (placeholder)
   */
  async createTeamsMeeting(serviceRequest, scheduledDateTime, duration) {
    throw new Error("Teams integration not implemented");
  }

  async updateTeamsMeeting(meetingId, newDateTime) {
    throw new Error("Teams integration not implemented");
  }

  async cancelTeamsMeeting(meetingId) {
    throw new Error("Teams integration not implemented");
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([name, config]) => config.enabled || this.mockMode)
      .map(([name, config]) => ({
        name,
        displayName: this.getProviderDisplayName(name),
        enabled: config.enabled || this.mockMode,
        mock: this.mockMode && !config.enabled,
      }));
  }

  getProviderDisplayName(provider) {
    const names = {
      zoom: "Zoom",
      googleMeet: "Google Meet",
      teams: "Microsoft Teams",
    };
    return names[provider] || provider;
  }
}

module.exports = new VCSchedulingService();
