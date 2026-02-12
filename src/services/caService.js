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
   * Helper to fetch and transform CA data for list views
   * @private
   */
  async _getCAListItems(
    whereClause = {},
    limit = 10,
    offset = 0,
    order = [["experienceYears", "DESC"]],
  ) {
    const { rows, count } = await CA.findAndCountAll({
      where: { ...whereClause, status: "active" },
      include: [
        { model: CAType, as: "caType" },
        {
          model: CAServiceModel,
          as: "caServices",
          include: [{ model: Service, as: "service" }],
        },
        {
          model: Review,
          as: "reviews",
          attributes: ["rating"],
        },
        {
          model: ServiceRequest,
          as: "serviceRequests",
          where: { status: "completed" },
          attributes: ["id"],
          required: false,
        },
      ],
      limit,
      offset,
      order,
      distinct: true,
    });

    const data = rows.map((ca) => {
      const ratings = ca.reviews?.map((r) => parseFloat(r.rating)) || [];
      const avgRating =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0;

      const prices =
        ca.caServices
          ?.map((cs) => parseFloat(cs.customPrice))
          .filter((p) => !isNaN(p)) || [];
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

      // Filter based on specialization if provided in whereClause (handled by include normally, but here we can be sure)
      return {
        id: ca.id,
        name: ca.name,
        image: ca.profileImage || ca.image,
        verified: ca.status === "active",
        specialization:
          ca.caServices
            ?.map((cs) => cs.service?.name)
            .filter(Boolean)
            .join(", ") || "Tax Consultant",
        rating: Number(avgRating.toFixed(1)),
        reviewCount: ratings.length,
        location: ca.location,
        completedFilings: ca.serviceRequests?.length || 0,
        experience: `${ca.experienceYears} years`,
        price:
          minPrice > 0 ? `₹${minPrice.toLocaleString()}` : "Contact for Price",
      };
    });

    return { data, count };
  }

  /**
   * Search and filter CAs
   */
  async searchCAs(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = {};

      if (filters.location) {
        whereClause.location = { [Op.iLike]: `%${filters.location}%` };
      }

      // Add other filters like experience range if present
      if (filters.minExperience !== undefined) {
        whereClause.experienceYears = { [Op.gte]: filters.minExperience };
      }

      // Sorting
      let order = [["experienceYears", "DESC"]];
      if (filters.sortBy === "experience") {
        order = [["experienceYears", "DESC"]];
      } else if (filters.sortBy === "rating") {
        // Sorting by rating usually requires subqueries or pre-calculation,
        // using experienceYears as fallback for now
        order = [["experienceYears", "DESC"]];
      }

      const result = await this._getCAListItems(
        whereClause,
        limit,
        offset,
        order,
      );

      // Post-filtering for specialization since it's based on joined data
      let data = result.data;
      if (filters.specialization) {
        data = data.filter((ca) =>
          ca.specialization
            .toLowerCase()
            .includes(filters.specialization.toLowerCase()),
        );
      }

      // Post-filtering for rating
      if (filters.minRating) {
        data = data.filter((ca) => ca.rating >= parseFloat(filters.minRating));
      }

      // Post-filtering for price
      if (filters.maxPrice) {
        data = data.filter((ca) => {
          const priceValue = parseInt(ca.price.replace(/[^\d]/g, ""));
          return isNaN(priceValue) || priceValue <= parseInt(filters.maxPrice);
        });
      }

      return {
        data,
        pagination: {
          page,
          limit,
          total: result.count,
          totalPages: Math.ceil(result.count / limit),
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
      // Get most experienced CAs as a proxy for "popular"
      const result = await this._getCAListItems({}, limit, 0, [
        ["experienceYears", "DESC"],
      ]);
      return result.data;
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
