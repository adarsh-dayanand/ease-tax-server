const {
  ServiceRequest,
  User,
  CA,
  Payment,
  Document,
  Meeting,
  CASpecialization,
} = require("../../models");
const cacheService = require("./cacheService");
const vcSchedulingService = require("./vcSchedulingService");
const logger = require("../config/logger");
const { Op, where } = require("sequelize");
const caService = require("./caService");

class CAManagementService {
  /**
   * Get CA dashboard data
   */
  async getCADashboard(caId) {
    try {
      const cacheKey = cacheService.getCacheKeys().CA_DASHBOARD(caId);
      let dashboard = await cacheService.get(cacheKey);

      if (!dashboard) {
        // Get basic stats
        const [
          totalRequests,
          pendingRequests,
          acceptedRequests,
          completedRequests,
          paymentsForEarnings,
          avgRating,
          ca,
        ] = await Promise.all([
          ServiceRequest.count({ where: { caId } }),
          ServiceRequest.count({
            where: { caId, status: "pending" },
          }),
          ServiceRequest.count({
            where: { caId, status: { [Op.in]: ["accepted", "in_progress"] } },
          }),
          ServiceRequest.count({
            where: { caId, status: "completed" },
          }),
          Payment.findAll({
            where: {
              payeeId: caId,
              status: "completed",
              paymentType: "service_fee",
            },
            attributes: [
              "id",
              "amount",
              "commissionAmount",
              "netAmount",
              "commissionPercentage",
              "metadata",
            ],
            raw: true,
          }),
          this.getCAAvgRating(caId),
          CA.findByPk(caId, {
            include: [
              {
                model: require("../../models").CAService,
                as: "caServices",
                where: { isActive: true },
              },
            ],
          }),
        ]);

        // Calculate total earnings from payments
        // IMPORTANT: Commission should be calculated on FULL SERVICE PRICE (totalAmount), not on (servicePrice - bookingFee)
        // The payment.amount is (servicePrice - bookingFee) + GST
        // But commission is calculated on the full servicePrice
        const caCommissionPercentage =
          parseFloat(ca?.commissionPercentage) || 8.0;
        const bookingFee = 999;
        const totalEarnings = paymentsForEarnings.reduce((sum, payment) => {
          const amount = parseFloat(payment.amount) || 0; // This is (servicePrice - bookingFee) + GST

          // Extract service price (totalAmount) from metadata
          let servicePrice = null;
          if (payment.metadata) {
            try {
              const metadata =
                typeof payment.metadata === "string"
                  ? JSON.parse(payment.metadata)
                  : payment.metadata;

              if (metadata.totalAmount) {
                servicePrice = parseFloat(metadata.totalAmount) || 0;
              }
            } catch (e) {
              logger.warn("Failed to parse payment metadata", {
                paymentId: payment.id,
                error: e.message,
              });
            }
          }

          // If servicePrice not found in metadata, calculate it from amount
          // amount = (servicePrice - bookingFee) + GST
          // amount = (servicePrice - 999) * 1.18
          // So: servicePrice = (amount / 1.18) + 999
          if (!servicePrice || servicePrice <= 0) {
            const baseFinalAmount = amount / 1.18; // Remove GST to get (servicePrice - bookingFee)
            servicePrice = baseFinalAmount + bookingFee;
          }

          // Calculate net amount correctly: servicePrice - commission on servicePrice
          // Commission should be calculated on full servicePrice, not on (servicePrice - bookingFee)
          const paymentCommissionPercentage =
            parseFloat(payment.commissionPercentage) || caCommissionPercentage;
          const commission = (servicePrice * paymentCommissionPercentage) / 100;
          const netAmount = servicePrice - commission;

          logger.debug("Earnings calculation", {
            paymentId: payment.id,
            amount,
            servicePrice,
            commissionPercentage: paymentCommissionPercentage,
            commission,
            netAmount,
          });

          return sum + (parseFloat(netAmount) || 0);
        }, 0);

        // Get recent requests
        const recentRequests = await ServiceRequest.findAll({
          where: { caId },
          limit: 5,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "profileImage"],
            },
          ],
        });

        // Get rating distribution
        const ratingDistribution =
          await caService.getCARatingDistribution(caId);

        dashboard = {
          ca: {
            id: ca.id,
            name: ca.name,
            image: ca.image,
            verified: ca.verified,
            completedFilings: ca.completedFilings,
            specializations:
              ca.specializations?.map((s) => s.specialization) || [],
          },
          stats: {
            totalRequests: totalRequests || 0,
            pendingRequests: pendingRequests || 0,
            acceptedRequests: acceptedRequests || 0,
            completedRequests: completedRequests || 0,
            totalEarnings: totalEarnings || 0,
            avgRating: avgRating || 0,
            successRate:
              totalRequests > 0
                ? ((completedRequests / totalRequests) * 100).toFixed(1)
                : 0,
            ratingDistribution: ratingDistribution || [
              { rating: 5, count: 0 },
              { rating: 4, count: 0 },
              { rating: 3, count: 0 },
              { rating: 2, count: 0 },
              { rating: 1, count: 0 },
            ],
          },
          recentRequests: recentRequests.map((req) => ({
            id: req.id,
            userName: req.user?.name || "Unknown User",
            userImage: req.user?.profileImage,
            purpose: req.purpose,
            status: req.status,
            createdAt: req.createdAt,
          })),
        };

        // Cache for 10 minutes
        await cacheService.set(cacheKey, dashboard, 600);
      }

      return dashboard;
    } catch (error) {
      logger.error("Error getting CA dashboard:", error);
      throw error;
    }
  }

  /**
   * Get CA service requests
   */
  async getCARequests(caId, status = null, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = { caId };

      if (status) {
        // Handle comma-separated status values
        const statusArray = status.split(",").map((s) => s.trim());
        if (statusArray.length > 1) {
          whereClause.status = { [Op.in]: statusArray };
        } else {
          whereClause.status = status;
        }
      }

      const { rows, count } = await ServiceRequest.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "phone", "profileImage"],
          },
          {
            model: Payment,
            as: "payments",
            attributes: ["id", "amount", "status", "paymentType"],
          },
        ],
      });

      const requests = rows.map((req) => ({
        id: req.id,
        user: {
          id: req.user?.id,
          name: req.user?.name,
          email: req.user?.email,
          phone: req.user?.phone,
          profileImage: req.user?.profileImage,
        },
        serviceType: req.serviceType,
        purpose: req.purpose,
        status: req.status,
        deadline: req.deadline,
        createdAt: req.createdAt,
        priority: req.priority,
        hasPayment:
          req.payments?.some((p) => p.status === "completed") || false,
        paymentStatus: this.getPaymentStatus(req.payments),
      }));

      return {
        data: requests,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting CA requests:", error);
      throw error;
    }
  }

  /**
   * Get specific request details
   */
  async getRequestDetails(requestId, caId) {
    try {
      logger.info("Getting request details", {
        requestId,
        caId,
      });

      const request = await ServiceRequest.findOne({
        where: { id: requestId, caId },
        include: [
          {
            model: User,
            as: "user",
            attributes: [
              "id",
              "name",
              "email",
              "phone",
              "profileImage",
              "pan",
              "gstin",
            ],
            required: false, // Make user optional in case of data inconsistency
          },
          {
            model: Payment,
            as: "payments",
            required: false,
          },
          {
            model: Document,
            as: "documents",
            where: { status: { [Op.ne]: "deleted" } },
            required: false,
          },
          {
            model: Meeting,
            as: "meeting",
            required: false,
          },
        ],
      });

      if (!request) {
        logger.warn("Request not found", {
          requestId,
          caId,
        });
        return null;
      }

      logger.info("Request found, preparing response", {
        requestId: request.id,
        hasUser: !!request.user,
        paymentsCount: request.payments?.length || 0,
        documentsCount: request.documents?.length || 0,
        hasMeeting: !!request.meeting,
      });

      return {
        id: request.id,
        user: request.user || null,
        serviceType: request.serviceType,
        purpose: request.purpose,
        additionalNotes: request.additionalNotes,
        status: request.status,
        deadline: request.deadline,
        priority: request.priority,
        createdAt: request.createdAt,
        metadata: request.metadata,
        payments: request.payments || [],
        documents: (request.documents || []).map((doc) => ({
          id: doc.id,
          name: doc.originalName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          status: doc.status,
          createdAt: doc.createdAt,
        })),
        meeting: request.meeting || null,
        hasEscrowPayment: (request.payments || []).some(
          (p) => p.paymentType === "booking_fee" && p.status === "completed"
        ),
      };
    } catch (error) {
      logger.error("Error getting request details:", {
        error: error.message,
        stack: error.stack,
        requestId,
        caId,
        errorName: error.name,
      });
      throw error;
    }
  }

  /**
   * Accept service request
   */
  async acceptRequest(requestId, caId, acceptanceData) {
    try {
      const { notes } = acceptanceData;

      const request = await ServiceRequest.findOne({
        where: { id: requestId, status: "pending" },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      if (!request) {
        throw new Error("Request not found or already processed");
      }

      // Update the request
      await request.update({
        caId,
        status: "accepted",
        metadata: {
          ...request.metadata,
          acceptedAt: new Date(),
          acceptanceNotes: notes,
          acceptedBy: caId,
        },
      });

      // Clear cache
      await this.clearCACache(caId);

      return {
        id: request.id,
        status: request.status,
        userId: request.userId,
      };
    } catch (error) {
      logger.error("Error accepting request:", error);
      throw error;
    }
  }

  /**
   * Reject service request
   */
  async rejectRequest(requestId, caId, reason) {
    try {
      const request = await ServiceRequest.findOne({
        where: { id: requestId, status: "pending" },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      if (!request) {
        throw new Error("Request not found or already processed");
      }

      await request.update({
        status: "rejected",
        cancellationReason: reason,
        metadata: {
          ...request.metadata,
          rejectedAt: new Date(),
          rejectedBy: caId,
          rejectionReason: reason,
        },
      });

      // Clear cache
      await this.clearCACache(caId);

      return {
        id: request.id,
        status: request.status,
        userId: request.userId,
      };
    } catch (error) {
      logger.error("Error rejecting request:", error);
      throw error;
    }
  }

  /**
   * Update request status
   */
  async updateRequestStatus(requestId, caId, status, notes) {
    try {
      const request = await ServiceRequest.findOne({
        where: { id: requestId, caId },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      if (!request) {
        throw new Error("Request not found or access denied");
      }

      await request.update({
        status,
        metadata: {
          ...request.metadata,
          statusUpdates: [
            ...(request.metadata?.statusUpdates || []),
            {
              status,
              notes,
              updatedAt: new Date(),
              updatedBy: caId,
            },
          ],
        },
      });

      await this.clearCACache(caId);

      return {
        id: request.id,
        status: request.status,
        userId: request.userId,
      };
    } catch (error) {
      logger.error("Error updating request status:", error);
      throw error;
    }
  }

  /**
   * Mark request as complete
   */
  async markRequestComplete(requestId, caId, completionData) {
    try {
      const { completionNotes, deliverables } = completionData;

      const request = await ServiceRequest.findOne({
        where: { id: requestId, caId },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      if (!request) {
        throw new Error("Request not found or access denied");
      }

      await request.update({
        status: "completed",
        completedAt: new Date(),
        metadata: {
          ...request.metadata,
          completionNotes,
          deliverables,
          completedBy: caId,
        },
      });

      // Update CA's completed filings count
      await CA.increment("completedFilings", { where: { id: caId } });

      await this.clearCACache(caId);

      return {
        id: request.id,
        status: request.status,
        userId: request.userId,
        completedAt: request.completedAt,
      };
    } catch (error) {
      logger.error("Error marking request complete:", error);
      throw error;
    }
  }

  /**
   * Get CA profile
   */
  async getCAProfile(caId) {
    try {
      const ca = await CA.findByPk(caId, {
        include: [
          {
            model: CASpecialization,
            as: "specializations",
          },
        ],
      });

      if (!ca) {
        throw new Error("CA not found");
      }

      return {
        id: ca.id,
        name: ca.name,
        email: ca.email,
        phone: ca.phone,
        location: ca.location,
        image: ca.image,
        verified: ca.verified,
        completedFilings: ca?.completedFilings,
        phoneVerified: ca?.phoneVerified,
        specializations: ca?.specializations,
      };
    } catch (error) {
      logger.error("Error getting CA profile:", error);
      throw error;
    }
  }

  /**
   * Update CA profile
   */
  async updateCAProfile(caId, updateData) {
    try {
      const ca = await CA.findByPk(caId);
      if (!ca) {
        throw new Error("CA not found");
      }

      const allowedFields = ["name", "phone", "location", "image"];

      const filteredData = {};
      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      await ca.update(filteredData);

      // Clear cache
      await this.clearCACache(caId);

      return await this.getCAProfile(caId);
    } catch (error) {
      logger.error("Error updating CA profile:", error);
      throw error;
    }
  }

  /**
   * Schedule meeting
   */
  async scheduleMeeting(requestId, caId, meetingData) {
    try {
      const { scheduledDateTime, duration, meetingType, agenda } = meetingData;

      const request = await ServiceRequest.findOne({
        where: { id: requestId, caId },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      if (!request) {
        throw new Error("Request not found or access denied");
      }

      // Generate meeting via VC service
      const vcMeeting = await vcSchedulingService.scheduleMeeting(
        requestId,
        scheduledDateTime,
        duration,
        meetingType || "zoom"
      );

      return {
        id: vcMeeting.id,
        scheduledDateTime: vcMeeting.scheduledDateTime,
        duration: vcMeeting.duration,
        meetingType: vcMeeting.provider,
        meetingUrl: vcMeeting.joinUrl,
        startUrl: vcMeeting.startUrl,
        password: vcMeeting.password,
        agenda: agenda,
        userId: request.userId,
        serviceRequestId: requestId,
      };
    } catch (error) {
      logger.error("Error scheduling meeting:", error);
      throw error;
    }
  }

  /**
   * Reschedule meeting
   */
  async rescheduleMeeting(meetingId, caId, rescheduleData) {
    try {
      const { newScheduledDateTime, reason } = rescheduleData;

      // First get the meeting details from the VC service
      const vcMeeting = await vcSchedulingService.getMeetingDetails(meetingId);

      if (!vcMeeting) {
        throw new Error("Meeting not found");
      }

      // Update VC meeting
      const updatedVCMeeting = await vcSchedulingService.rescheduleMeeting(
        meetingId,
        newScheduledDateTime
      );

      return {
        id: updatedVCMeeting.id,
        scheduledDateTime: updatedVCMeeting.scheduledDateTime,
        meetingUrl: updatedVCMeeting.joinUrl,
        startUrl: updatedVCMeeting.startUrl,
        password: updatedVCMeeting.password,
        serviceRequestId: vcMeeting.serviceRequestId,
        rescheduleReason: reason,
      };
    } catch (error) {
      logger.error("Error rescheduling meeting:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async getCAAvgRating(caId) {
    try {
      const { Review } = require("../../models");
      const result = await Review.findOne({
        where: { caId },
        attributes: [
          [
            require("sequelize").fn("AVG", require("sequelize").col("rating")),
            "avgRating",
          ],
        ],
      });
      return parseFloat(result?.dataValues?.avgRating || 0).toFixed(1);
    } catch (error) {
      logger.error("Error getting CA average rating:", error);
      return 0;
    }
  }

  getPaymentStatus(payments) {
    if (!payments || payments.length === 0) return "unpaid";

    const hasBookingFee = payments.some(
      (p) => p.paymentType === "booking_fee" && p.status === "completed"
    );
    const hasServiceFee = payments.some(
      (p) => p.paymentType === "service_fee" && p.status === "completed"
    );

    if (hasBookingFee && hasServiceFee) return "fully_paid";
    if (hasBookingFee) return "booking_paid";
    return "unpaid";
  }

  /**
   * Clear CA related cache
   */
  async clearCACache(caId) {
    try {
      const keys = cacheService.getCacheKeys();
      await Promise.all([
        cacheService.del(keys.CA_DASHBOARD(caId)),
        cacheService.del(keys.CA_PROFILE(caId)),
        cacheService.delPattern(`ca:requests:${caId}*`),
      ]);
    } catch (error) {
      logger.error("Error clearing CA cache:", error);
    }
  }
}

module.exports = new CAManagementService();
