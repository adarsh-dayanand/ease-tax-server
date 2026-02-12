const {
  CA,
  CAService: CAServiceModel,
  Service,
  Review,
  ServiceRequest,
  User,
  CAType,
  sequelize,
} = require("../../models");
const logger = require("../config/logger");
const { Op, QueryTypes } = require("sequelize");

class CAService {
  /**
   * Search and filter CAs
   */
  async searchCAs(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = { status: "active" };

      if (filters.specialization) {
        whereClause.specialization = {
          [Op.contains]: [filters.specialization],
        };
      }

      if (filters.location) {
        whereClause.location = { [Op.iLike]: `%${filters.location}%` };
      }

      const { rows, count } = await CA.findAndCountAll({
        where: whereClause,
        include: [{ model: CAType, as: "caType" }],
        limit,
        offset,
        order: [["experienceYears", "DESC"]],
      });

      const transformedCAs = rows.map((ca) => ({
        id: ca.id,
        name: ca.name,
        specialization: ca.specialization?.join(", ") || "Tax Consultant",
        experience: ca.experienceYears,
        location: ca.location,
        image: ca.profileImage,
        verified: ca.status === "active",
        caType: ca.caType?.name,
      }));

      return {
        data: transformedCAs,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
        filters,
      };
    } catch (error) {
      logger.error("Error searching CAs:", error);
      throw error;
    }
  }

  /**
   * Get CA profile with detailed information
   */
  async getCAProfile(caId) {
    try {
      const ca = await CA.findByPk(caId, {
        include: [{ model: CAType, as: "caType" }],
      });

      if (!ca) return null;

      // Fetch related data
      const [
        caServicesResult,
        reviewsResult,
        reviewStats,
        completedFilingsCount,
        ratingDistribution,
      ] = await Promise.all([
        CAServiceModel.findAll({
          where: { caId, isActive: true },
          include: [{ model: Service, as: "service" }],
        }),
        Review.findAll({
          where: { caId },
          limit: 10,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "profileImage"],
            },
          ],
        }),
        Review.findOne({
          where: { caId },
          attributes: [
            [sequelize.fn("COUNT", sequelize.col("id")), "totalReviews"],
            [sequelize.fn("AVG", sequelize.col("rating")), "avgRating"],
          ],
          raw: true,
        }),
        ServiceRequest.count({ where: { caId, status: "completed" } }),
        this.getCARatingDistribution(caId),
      ]);

      const averageRating = parseFloat(reviewStats?.avgRating || 0);

      return {
        id: ca.id,
        name: ca.name,
        specialization: ca.specialization?.join(", ") || "Tax Consultant",
        experience: ca.experienceYears,
        rating: Number(averageRating.toFixed(1)),
        reviewCount: parseInt(reviewStats?.totalReviews || 0, 10),
        location: ca.location,
        image: ca.profileImage,
        verified: ca.status === "active",
        completedFilings: completedFilingsCount,
        commission: ca.commissionPercentage,
        bio: ca.bio,
        qualifications: ca.qualifications,
        languages: ca.languages,
        caType: ca.caType ? { id: ca.caType.id, name: ca.caType.name } : null,
        ratingDistribution,
        services: caServicesResult.map((cs) => ({
          id: cs.service?.id,
          caServiceId: cs.id,
          name: cs.service?.name,
          price: cs.customPrice,
          currency: cs.currency || "INR",
          notes: cs.notes,
          category: cs.service.category,
        })),
        reviews: reviewsResult.map((r) => ({
          id: r.id,
          name: r.user?.name,
          rating: r.rating,
          comment: r.review,
          image: r.user?.profileImage,
          date: this.formatDate(r.createdAt),
        })),
      };
    } catch (error) {
      logger.error("Error getting CA profile:", error);
      throw error;
    }
  }

  /**
   * Get CA reviews with pagination
   */
  async getCAReviews(caId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const { rows, count } = await Review.findAndCountAll({
        where: { caId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: User,
            as: "user",
            attributes: [
              "id",
              "name",
              "profileImage",
              ["profileImage", "image"],
            ],
          },
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
      logger.error("Error getting CA reviews:", error);
      throw error;
    }
  }

  /**
   * Submit a review for a CA
   */
  async submitReview(userId, caId, serviceRequestId, rating, review = null) {
    try {
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId);
      if (!serviceRequest) throw new Error("Service request not found");
      if (serviceRequest.userId !== userId) throw new Error("Unauthorized");
      if (serviceRequest.caId !== caId) throw new Error("CA mismatch");
      if (serviceRequest.status !== "completed")
        throw new Error("Service not completed");

      const [newReview, created] = await Review.findOrCreate({
        where: { serviceRequestId, userId, caId },
        defaults: {
          rating,
          review,
          isVerified: true,
          reviewType: "overall",
        },
      });

      if (!created) {
        await newReview.update({ rating, review: review || newReview.review });
      }

      return newReview;
    } catch (error) {
      logger.error("Error submitting review:", error);
      throw error;
    }
  }

  /**
   * Get popular CAs
   */
  async getPopularCAs(limit = 10) {
    try {
      const cas = await CA.findAll({
        where: { status: "active" },
        limit,
        order: [["experienceYears", "DESC"]],
      });

      return Promise.all(cas.map((ca) => this.getCAProfile(ca.id)));
    } catch (error) {
      logger.error("Error getting popular CAs:", error);
      throw error;
    }
  }

  /**
   * Get CA rating distribution
   */
  async getCARatingDistribution(caId) {
    try {
      const stats = await Review.findAll({
        where: { caId },
        attributes: [
          "rating",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: ["rating"],
        raw: true,
      });

      const distribution = [1, 2, 3, 4, 5].map((r) => {
        const found = stats.find((s) => Number(s.rating) === r);
        return { rating: r, count: found ? parseInt(found.count, 10) : 0 };
      });

      return distribution;
    } catch (error) {
      logger.error("Error getting rating distribution:", error);
      return [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 }));
    }
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString();
  }
}

module.exports = new CAService();
