const {
  User,
  CA,
  ServiceRequest,
  Payment,
  Review,
  Notification,
} = require("../../models");
const logger = require("../config/logger");
const { Op, fn, col, literal } = require("sequelize");
const bcrypt = require("bcryptjs");

class AdminService {
  /**
   * Get all CAs with filters
   */
  async getAllCAs(status = null, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = {};

      if (status) {
        if (status === "verified") {
          whereClause.status = "active";
        } else if (status === "pending") {
          whereClause.status = "pending_registration";
        } else if (status === "suspended") {
          whereClause.status = "suspended";
        }
      }

      const { rows, count } = await CA.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });

      const completedCounts = await ServiceRequest.findAll({
        where: {
          caId: { [Op.in]: rows.map((ca) => ca.id) },
          status: "completed",
        },
        attributes: ["caId", [fn("COUNT", col("id")), "count"]],
        group: ["caId"],
        raw: true,
      });
      const completedByCaId = Object.fromEntries(
        completedCounts.map((r) => [r.caId, parseInt(r.count, 10) || 0]),
      );

      const cas = rows.map((ca) => ({
        id: ca.id,
        name: ca.name,
        email: ca.email,
        phone: ca.phone,
        location: ca.location,
        image: ca.profileImage,
        verified: ca.status === "active",
        status: ca.status || "active",
        completedFilings: completedByCaId[ca.id] || 0,
        phoneVerified: ca.phoneVerified,
        lastLogin: ca.lastLogin,
        createdAt: ca.createdAt,
      }));

      return {
        data: cas,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting all CAs:", error);
      throw error;
    }
  }

  /**
   * Get pending CA verifications
   */
  async getPendingCAs(page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      const { rows, count } = await CA.findAndCountAll({
        where: { status: "pending_registration" },
        limit,
        offset,
        order: [["createdAt", "ASC"]], // Oldest first for verification queue
      });

      const pendingCAs = rows.map((ca) => ({
        id: ca.id,
        name: ca.name,
        email: ca.email,
        phone: ca.phone,
        location: ca.location,
        image: ca.profileImage,
        registeredAt: ca.createdAt,
        daysPending: Math.floor(
          (new Date() - new Date(ca.createdAt)) / (1000 * 60 * 60 * 24),
        ),
      }));

      return {
        data: pendingCAs,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting pending CAs:", error);
      throw error;
    }
  }

  /**
   * Register new CA (admin only)
   */
  async registerCA(caData, adminId) {
    try {
      const {
        name,
        email,
        phone,
        location,
        autoVerify = false,
        caNumber,
        caTypeId,
        commissionPercentage,
      } = caData;

      // Check if CA already exists
      const existingCA = await CA.findOne({
        where: {
          [Op.or]: [
            { email },
            { phone },
            caNumber ? { caNumber } : null,
          ].filter(Boolean),
        },
      });

      if (existingCA) {
        throw new Error(
          "CA with this email, phone or CA number already exists",
        );
      }

      // Create CA account
      const ca = await CA.create({
        name,
        email,
        phone,
        location,
        caNumber,
        caTypeId,
        commissionPercentage: parseFloat(commissionPercentage),
        phoneVerified: true, // Admin registered CAs are phone verified
        status: autoVerify ? "active" : "pending_registration",
        metadata: {
          registeredBy: adminId,
          registeredAt: new Date(),
          registrationType: "admin",
        },
      });

      return await this.getCADetails(ca.id);
    } catch (error) {
      logger.error("Error registering CA:", error);
      throw error;
    }
  }

  /**
   * Verify CA
   */
  async verifyCA(caId, adminId, verificationNotes = null) {
    try {
      const ca = await CA.findByPk(caId);

      if (!ca) {
        throw new Error("CA not found");
      }

      if (ca.status === "active") {
        throw new Error("CA is already verified");
      }

      await ca.update({
        status: "active",
        metadata: {
          ...ca.metadata,
          verifiedBy: adminId,
          verifiedAt: new Date(),
          verificationNotes,
        },
      });

      return await this.getCADetails(caId);
    } catch (error) {
      logger.error("Error verifying CA:", error);
      throw error;
    }
  }

  /**
   * Reject CA verification
   */
  async rejectCA(caId, adminId, rejectionReason) {
    try {
      const ca = await CA.findByPk(caId);

      if (!ca) {
        throw new Error("CA not found");
      }

      await ca.update({
        status: "rejected",
        metadata: {
          ...ca.metadata,
          rejectedBy: adminId,
          rejectedAt: new Date(),
          rejectionReason,
        },
      });

      return await this.getCADetails(caId);
    } catch (error) {
      logger.error("Error rejecting CA:", error);
      throw error;
    }
  }

  /**
   * Suspend CA
   */
  async suspendCA(caId, adminId, suspensionReason) {
    try {
      const ca = await CA.findByPk(caId);

      if (!ca) {
        throw new Error("CA not found");
      }

      await ca.update({
        status: "suspended",
        metadata: {
          ...ca.metadata,
          suspendedBy: adminId,
          suspendedAt: new Date(),
          suspensionReason,
        },
      });

      return await this.getCADetails(caId);
    } catch (error) {
      logger.error("Error suspending CA:", error);
      throw error;
    }
  }

  /**
   * Activate CA
   */
  async activateCA(caId, adminId, activationNotes = null) {
    try {
      const ca = await CA.findByPk(caId);

      if (!ca) {
        throw new Error("CA not found");
      }

      await ca.update({
        status: "active",
        metadata: {
          ...ca.metadata,
          activatedBy: adminId,
          activatedAt: new Date(),
          activationNotes,
        },
      });

      return await this.getCADetails(caId);
    } catch (error) {
      logger.error("Error activating CA:", error);
      throw error;
    }
  }

  /**
   * Update CA commission percentage
   */
  async updateCACommission(caId, commissionPercentage) {
    try {
      const ca = await CA.findByPk(caId);

      if (!ca) {
        throw new Error("CA not found");
      }

      await ca.update({
        commissionPercentage: parseFloat(commissionPercentage),
      });

      return {
        id: ca.id,
        name: ca.name,
        email: ca.email,
        commissionPercentage: ca.commissionPercentage,
      };
    } catch (error) {
      logger.error("Error updating CA commission:", error);
      throw error;
    }
  }

  /**
   * Get all users with filters
   */
  async getAllUsers(status = null, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = {};

      if (status) {
        whereClause.status = status;
      }

      const { rows, count } = await User.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "name",
          "email",
          "phone",
          "pan",
          "gstin",
          "phoneVerified",
          "profileImage",
          "status",
          "lastLogin",
          "createdAt",
        ],
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
      logger.error("Error getting all users:", error);
      throw error;
    }
  }

  /**
   * Suspend user
   */
  async suspendUser(userId, adminId, suspensionReason) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error("User not found");
      }

      await user.update({
        status: "suspended",
        metadata: {
          ...user.metadata,
          suspendedBy: adminId,
          suspendedAt: new Date(),
          suspensionReason,
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      };
    } catch (error) {
      logger.error("Error suspending user:", error);
      throw error;
    }
  }

  /**
   * Activate user
   */
  async activateUser(userId, adminId, activationNotes = null) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error("User not found");
      }

      await user.update({
        status: "active",
        metadata: {
          ...user.metadata,
          activatedBy: adminId,
          activatedAt: new Date(),
          activationNotes,
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      };
    } catch (error) {
      logger.error("Error activating user:", error);
      throw error;
    }
  }

  /**
   * Get all service requests
   */
  async getAllServiceRequests(status = null, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = {};

      if (status) {
        whereClause.status = status;
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
            attributes: ["id", "name", "email"],
          },
          {
            model: CA,
            as: "ca",
            attributes: ["id", "name", "email"],
            required: false,
          },
        ],
      });

      const requests = rows.map((req) => ({
        id: req.id,
        user: req.user,
        ca: req.ca,
        serviceType: req.serviceType,
        purpose: req.purpose,
        status: req.status,
        priority: req.priority,
        deadline: req.deadline,
        createdAt: req.createdAt,
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
      logger.error("Error getting all service requests:", error);
      throw error;
    }
  }

  /**
   * Get escalated requests
   */
  async getEscalatedRequests(page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      const { rows, count } = await ServiceRequest.findAndCountAll({
        where: { status: "escalated" },
        limit,
        offset,
        order: [["escalatedAt", "ASC"]],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
          {
            model: CA,
            as: "ca",
            attributes: ["id", "name", "email"],
            required: false,
          },
        ],
      });

      const requests = rows.map((req) => ({
        id: req.id,
        user: req.user,
        ca: req.ca,
        serviceType: req.serviceType,
        purpose: req.purpose,
        status: req.status,
        priority: req.priority,
        escalatedAt: req.escalatedAt,
        daysSinceEscalation: Math.floor(
          (new Date() - new Date(req.escalatedAt)) / (1000 * 60 * 60 * 24),
        ),
        createdAt: req.createdAt,
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
      logger.error("Error getting escalated requests:", error);
      throw error;
    }
  }

  /**
   * Assign CA to request
   */
  async assignCAToRequest(requestId, caId, adminId) {
    try {
      const [request, ca] = await Promise.all([
        ServiceRequest.findByPk(requestId),
        CA.findByPk(caId),
      ]);

      if (!request) {
        throw new Error("Service request not found");
      }

      if (!ca) {
        throw new Error("CA not found");
      }

      if (ca.status !== "active") {
        throw new Error("Cannot assign unverified CA");
      }

      await request.update({
        caId,
        status: "assigned",
        metadata: {
          ...request.metadata,
          assignedBy: adminId,
          assignedAt: new Date(),
          assignmentType: "admin",
        },
      });

      return {
        id: request.id,
        status: request.status,
        caId: ca.id,
        caName: ca.name,
      };
    } catch (error) {
      logger.error("Error assigning CA to request:", error);
      throw error;
    }
  }

  /**
   * Get admin dashboard analytics
   */
  async getAdminDashboard() {
    try {
      const [
        totalUsers,
        totalCAs,
        verifiedCAs,
        pendingCAs,
        totalRequests,
        activeRequests,
        totalRevenue,
        monthlyRevenue,
        averageRating,
      ] = await Promise.all([
        User.count(),
        CA.count(),
        CA.count({ where: { status: "active" } }),
        CA.count({ where: { status: "pending_registration" } }),
        ServiceRequest.count(),
        ServiceRequest.count({
          where: { status: { [Op.in]: ["accepted", "in_progress"] } },
        }),
        Payment.sum("amount", {
          where: { status: "completed", paymentType: "service_fee" },
        }),
        Payment.sum("amount", {
          where: {
            status: "completed",
            paymentType: "service_fee",
            createdAt: {
              [Op.gte]: new Date(
                new Date().setMonth(new Date().getMonth() - 1),
              ),
            },
          },
        }),
        Review.findOne({
          attributes: [[fn("AVG", col("rating")), "avgRating"]],
        }),
      ]);

      return {
        users: {
          total: totalUsers,
          growth: 0, // Calculate growth if needed
        },
        cas: {
          total: totalCAs,
          verified: verifiedCAs,
          pending: pendingCAs,
          verificationRate:
            totalCAs > 0 ? ((verifiedCAs / totalCAs) * 100).toFixed(1) : 0,
        },
        requests: {
          total: totalRequests,
          active: activeRequests,
          completionRate:
            totalRequests > 0
              ? (
                  ((totalRequests - activeRequests) / totalRequests) *
                  100
                ).toFixed(1)
              : 0,
        },
        revenue: {
          total: totalRevenue || 0,
          monthly: monthlyRevenue || 0,
          currency: "INR",
        },
        quality: {
          averageRating: parseFloat(
            averageRating?.dataValues?.avgRating || 0,
          ).toFixed(1),
          totalReviews: await Review.count(),
        },
      };
    } catch (error) {
      logger.error("Error getting admin dashboard:", error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(period = "30d") {
    try {
      let dateFilter;
      const now = new Date();

      switch (period) {
        case "7d":
          dateFilter = new Date(now.setDate(now.getDate() - 7));
          break;
        case "30d":
          dateFilter = new Date(now.setDate(now.getDate() - 30));
          break;
        case "90d":
          dateFilter = new Date(now.setDate(now.getDate() - 90));
          break;
        case "1y":
          dateFilter = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          dateFilter = new Date(now.setDate(now.getDate() - 30));
      }

      const [totalRevenue, bookingFees, serviceFees, refunds, dailyRevenue] =
        await Promise.all([
          Payment.sum("amount", {
            where: {
              status: "completed",
              createdAt: { [Op.gte]: dateFilter },
            },
          }),
          Payment.sum("amount", {
            where: {
              status: "completed",
              paymentType: "booking_fee",
              createdAt: { [Op.gte]: dateFilter },
            },
          }),
          Payment.sum("amount", {
            where: {
              status: "completed",
              paymentType: "service_fee",
              createdAt: { [Op.gte]: dateFilter },
            },
          }),
          Payment.sum("amount", {
            where: {
              status: "completed",
              paymentType: "refund",
              createdAt: { [Op.gte]: dateFilter },
            },
          }),
          Payment.findAll({
            attributes: [
              [fn("DATE", col("createdAt")), "date"],
              [fn("SUM", col("amount")), "revenue"],
            ],
            where: {
              status: "completed",
              createdAt: { [Op.gte]: dateFilter },
            },
            group: [fn("DATE", col("createdAt"))],
            order: [[fn("DATE", col("createdAt")), "ASC"]],
          }),
        ]);

      return {
        summary: {
          totalRevenue: totalRevenue || 0,
          bookingFees: bookingFees || 0,
          serviceFees: serviceFees || 0,
          refunds: Math.abs(refunds || 0),
          netRevenue: (totalRevenue || 0) - Math.abs(refunds || 0),
        },
        dailyRevenue: dailyRevenue.map((item) => ({
          date: item.dataValues.date,
          revenue: parseFloat(item.dataValues.revenue),
        })),
      };
    } catch (error) {
      logger.error("Error getting revenue analytics:", error);
      throw error;
    }
  }

  /**
   * Get CA performance analytics
   */
  async getCAPerformanceAnalytics(period = "30d", limit = 10) {
    try {
      let dateFilter;
      const now = new Date();

      switch (period) {
        case "7d":
          dateFilter = new Date(now.setDate(now.getDate() - 7));
          break;
        case "30d":
          dateFilter = new Date(now.setDate(now.getDate() - 30));
          break;
        case "90d":
          dateFilter = new Date(now.setDate(now.getDate() - 90));
          break;
        default:
          dateFilter = new Date(now.setDate(now.getDate() - 30));
      }

      const topCAs = await CA.findAll({
        attributes: [
          "id",
          "name",
          [
            literal(`(
              SELECT COUNT(*)
              FROM service_requests
              WHERE service_requests.caId = CA.id
              AND service_requests.status = 'completed'
            )`),
            "completedFilings",
          ],
          [
            literal(`(
              SELECT AVG(rating)
              FROM reviews
              WHERE reviews.caId = CA.id
            )`),
            "avgRating",
          ],
          [
            literal(`(
              SELECT SUM(amount)
              FROM payments
              WHERE payments.payeeId = CA.id
              AND payments.status = 'completed'
              AND payments.createdAt >= '${dateFilter.toISOString()}'
            )`),
            "periodRevenue",
          ],
        ],
        where: { status: "active" },
        order: [[literal('"completedFilings"'), "DESC"]],
        limit,
      });

      return topCAs.map((ca) => ({
        id: ca.id,
        name: ca.name,
        completedFilings: parseInt(ca.dataValues.completedFilings || 0, 10),
        avgRating: parseFloat(ca.dataValues.avgRating || 0).toFixed(1),
        periodRevenue: parseFloat(ca.dataValues.periodRevenue || 0),
      }));
    } catch (error) {
      logger.error("Error getting CA performance analytics:", error);
      throw error;
    }
  }

  /**
   * Get system configuration
   */
  async getSystemConfig() {
    try {
      // This would typically come from a config table or environment variables
      return {
        payments: {
          bookingFee: 999,
          commissionRate: 8,
          currency: "INR",
        },
        limits: {
          maxFileSize: "10MB",
          maxDocuments: 10,
          maxReschedules: 2,
        },
        features: {
          autoVerifyCA: false,
          enableEscalation: true,
          enableNotifications: true,
        },
        integrations: {
          razorpay: !!process.env.RAZORPAY_KEY_ID,
          zoom: !!process.env.ZOOM_API_KEY,
          googleMeet: !!process.env.GOOGLE_MEET_CLIENT_ID,
        },
      };
    } catch (error) {
      logger.error("Error getting system config:", error);
      throw error;
    }
  }

  /**
   * Update system configuration
   */
  async updateSystemConfig(configUpdates, adminId) {
    try {
      // In a real implementation, this would update a configuration table
      // For now, we'll just validate and return the updates
      const allowedKeys = [
        "payments.bookingFee",
        "payments.commissionRate",
        "limits.maxFileSize",
        "limits.maxDocuments",
        "limits.maxReschedules",
        "features.autoVerifyCA",
        "features.enableEscalation",
        "features.enableNotifications",
      ];

      const validUpdates = {};
      Object.keys(configUpdates).forEach((key) => {
        if (allowedKeys.includes(key)) {
          validUpdates[key] = configUpdates[key];
        }
      });

      // Log configuration changes
      logger.info("System configuration updated by admin", {
        adminId,
        updates: validUpdates,
        timestamp: new Date(),
      });

      return validUpdates;
    } catch (error) {
      logger.error("Error updating system config:", error);
      throw error;
    }
  }

  /**
   * Helper method to get CA details
   */
  async getCADetails(caId) {
    try {
      const ca = await CA.findByPk(caId);

      if (!ca) {
        return null;
      }

      const completedFilings = await ServiceRequest.count({
        where: { caId, status: "completed" },
      });

      return {
        id: ca.id,
        name: ca.name,
        email: ca.email,
        phone: ca.phone,
        location: ca.location,
        image: ca.profileImage,
        verified: ca.status === "active",
        status: ca.status || "active",
        completedFilings,
        phoneVerified: ca.phoneVerified,
        lastLogin: ca.lastLogin,
        createdAt: ca.createdAt,
        metadata: ca.metadata,
      };
    } catch (error) {
      logger.error("Error getting CA details:", error);
      throw error;
    }
  }
}

module.exports = new AdminService();
