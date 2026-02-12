const {
  ServiceRequest,
  User,
  CA,
  Payment,
  Document,
  Meeting,
  sequelize,
} = require("../../models");
const vcSchedulingService = require("./vcSchedulingService");
const logger = require("../config/logger");
const { Op, where } = require("sequelize");
const documentService = require("./documentService");
const caService = require("./caService");

class CAManagementService {
  /**
   * Get CA dashboard data
   */
  async getCADashboard(caId) {
    try {
      const startTime = Date.now();
      logger.info(`[Dashboard] Starting dashboard fetch for CA: ${caId}`);

      logger.info(`[Dashboard] Fetching from DB for CA: ${caId}`);
      const dbStartTime = Date.now();

      // Get basic stats and data in parallel
      let statusCountsRaw, paymentsForEarnings, avgRating, ca;
      try {
        logger.info(`[Dashboard] Starting parallel queries for CA: ${caId}`);

        [statusCountsRaw, paymentsForEarnings, avgRating, ca] =
          await Promise.all([
            // Consolidate 4 count queries into 1 grouped query
            ServiceRequest.findAll({
              where: { caId },
              attributes: [
                "status",
                [sequelize.fn("COUNT", sequelize.col("id")), "count"],
              ],
              group: ["status"],
              raw: true,
            }).catch((err) => {
              logger.error(
                `[Dashboard] Status counts query failed for CA: ${caId}`,
                {
                  error: err.message,
                  stack: err.stack,
                },
              );
              throw err;
            }),
            Payment.findAll({
              where: {
                payeeId: caId,
                status: "completed",
                paymentType: { [Op.in]: ["service_fee", "booking_fee"] },
              },
              attributes: [
                "id",
                "amount",
                "commissionAmount",
                "netAmount",
                "commissionPercentage",
                "paymentType",
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
                  required: false,
                },
              ],
            }),
          ]);

        logger.info(
          `[Dashboard] Parallel queries completed for CA: ${caId} (${Date.now() - dbStartTime}ms)`,
        );
      } catch (error) {
        logger.error(`[Dashboard] Parallel queries failed for CA: ${caId}`, {
          error: error.message,
          stack: error.stack,
          caId,
        });
        throw error;
      }

      // Process status counts
      const countsStartTime = Date.now();
      const counts = {
        total: 0,
        pending: 0,
        accepted: 0,
        in_progress: 0,
        completed: 0,
        rejected: 0,
        cancelled: 0,
      };

      statusCountsRaw.forEach((item) => {
        const count = parseInt(item.count, 10) || 0;
        counts[item.status] = count;
        counts.total += count;
      });

      const totalRequests = counts.total;
      const pendingRequests = counts.pending;
      const acceptedRequests =
        counts.pending + counts.accepted + counts.in_progress;
      const completedRequests = counts.completed;

      // Log counts for debugging
      logger.info(
        `[Dashboard] Status counts processed for CA: ${caId} (${Date.now() - countsStartTime}ms)`,
        {
          totalRequests,
          pendingRequests,
          acceptedRequests,
          completedRequests,
        },
      );

      // Calculate total earnings from payments
      // IMPORTANT: Commission should be calculated on FULL SERVICE PRICE (totalAmount), not on (servicePrice - bookingFee)
      const earningsStartTime = Date.now();
      const caCommissionPercentage =
        parseFloat(ca?.commissionPercentage) || 8.0;
      logger.info(
        `[Dashboard] Commission percentage for CA ${caId}: ${caCommissionPercentage}`,
      );
      const bookingFee = 999;

      let totalGrossEarnings = 0;
      let totalCommission = 0;
      let totalEarnings = 0;

      logger.info(
        `[Dashboard] Processing ${paymentsForEarnings.length} payments for CA: ${caId}`,
      );

      paymentsForEarnings.forEach((payment) => {
        const amountWithGst = parseFloat(payment.amount) || 0;
        const baseAmount = amountWithGst / 1.18; // Exclude 18% GST

        // Use stored commission if available, else calculate from base amount
        const paymentCommissionPercentage =
          parseFloat(payment.commissionPercentage) || caCommissionPercentage;

        let commission = parseFloat(payment.commissionAmount) || 0;
        if (commission <= 0) {
          commission = (baseAmount * paymentCommissionPercentage) / 100;
        }

        const netAmount = baseAmount - commission;

        totalGrossEarnings += baseAmount;
        totalCommission += commission;
        totalEarnings += netAmount;

        logger.info("Earnings calculation", {
          paymentId: payment.id,
          type: payment.paymentType,
          amountWithGst,
          baseAmount,
          commission,
          netAmount,
        });
      });

      logger.info(
        `[Dashboard] Earnings calculated for CA: ${caId} (${Date.now() - earningsStartTime}ms)`,
        {
          paymentCount: paymentsForEarnings.length,
          totalEarnings,
        },
      );

      // Get recent requests
      const recentRequestsStartTime = Date.now();
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
      logger.info(
        `[Dashboard] Recent requests fetched for CA: ${caId} (${Date.now() - recentRequestsStartTime}ms)`,
      );

      // Get rating distribution
      const ratingStartTime = Date.now();
      const ratingDistribution = await caService.getCARatingDistribution(caId);
      logger.info(
        `[Dashboard] Rating distribution fetched for CA: ${caId} (${Date.now() - ratingStartTime}ms)`,
      );

      const dashboard = {
        ca: {
          id: ca.id,
          name: ca.name,
          image: ca.profileImage,
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
          totalEarnings: Math.round(totalEarnings * 100) / 100 || 0,
          totalCommission: Math.round(totalCommission * 100) / 100 || 0,
          grossEarnings: Math.round(totalGrossEarnings * 100) / 100 || 0,
          avgRating: avgRating || 0,
          successRate: (() => {
            // Calculate success rate excluding pending requests
            // Only consider approved (accepted/in_progress), rejected, and completed requests
            const processedRequests = totalRequests - pendingRequests;
            return processedRequests > 0
              ? ((completedRequests / processedRequests) * 100).toFixed(1)
              : "0.0";
          })(),
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

      logger.info(
        `[Dashboard] Dashboard built successfully for CA: ${caId}, total time: ${Date.now() - startTime}ms`,
      );

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
          (p) => p.paymentType === "booking_fee" && p.status === "completed",
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
      const ca = await CA.findByPk(caId);

      if (!ca) {
        throw new Error("CA not found");
      }

      return {
        id: ca.id,
        name: ca.name,
        email: ca.email,
        phone: ca.phone,
        countryCode: ca.countryCode || null,
        location: ca.location,
        image: ca.profileImage,
        verified: ca.verified,
        completedFilings: ca?.completedFilings,
        phoneVerified: ca?.phoneVerified,
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

      const allowedFields = [
        "name",
        "phone",
        "countryCode",
        "location",
        "image",
        "profileImage",
      ];

      const filteredData = {};
      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      if (
        updateData.profileImage &&
        updateData.profileImage.startsWith("data:image/")
      ) {
        const s3Url = await documentService.uploadProfileImage(
          updateData.profileImage,
          caId,
          "ca",
        );
        filteredData.profileImage = s3Url;
      } else if (
        updateData.image &&
        updateData.image.startsWith("data:image/")
      ) {
        const s3Url = await documentService.uploadProfileImage(
          updateData.image,
          caId,
          "ca",
        );
        filteredData.profileImage = s3Url;
      } else if (updateData.profileImage !== undefined) {
        filteredData.profileImage = updateData.profileImage;
      } else if (updateData.image !== undefined) {
        filteredData.profileImage = updateData.image;
      }

      await ca.update(filteredData);

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
        meetingType || "zoom",
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
        newScheduledDateTime,
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
      (p) => p.paymentType === "booking_fee" && p.status === "completed",
    );
    const hasServiceFee = payments.some(
      (p) => p.paymentType === "service_fee" && p.status === "completed",
    );

    if (hasBookingFee && hasServiceFee) return "fully_paid";
    if (hasBookingFee) return "booking_paid";
    return "unpaid";
  }
}

module.exports = new CAManagementService();
