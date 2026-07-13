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
   * Parse display price like "₹1,999" into a number (NaN if contact-only)
   * @private
   */
  _parsePrice(price) {
    if (!price || typeof price !== "string") return NaN;
    return parseInt(price.replace(/[^\d]/g, ""), 10);
  }

  /**
   * Parse "N years" experience string
   * @private
   */
  _parseExperienceYears(experience) {
    if (typeof experience === "number") return experience;
    if (!experience) return 0;
    return parseInt(String(experience).replace(/[^\d]/g, ""), 10) || 0;
  }

  /**
   * Search and filter CAs
   */
  async searchCAs(filters = {}, page = 1, limit = 50) {
    try {
      const andConditions = [];

      if (filters.location) {
        andConditions.push({
          location: { [Op.iLike]: `%${filters.location}%` },
        });
      }

      const searchQuery = filters.searchQuery || filters.search || filters.q;
      if (searchQuery) {
        andConditions.push({
          [Op.or]: [
            { name: { [Op.iLike]: `%${searchQuery}%` } },
            { location: { [Op.iLike]: `%${searchQuery}%` } },
            { bio: { [Op.iLike]: `%${searchQuery}%` } },
          ],
        });
      }

      const experienceClause = {};
      if (
        filters.minExperience !== undefined &&
        filters.minExperience !== ""
      ) {
        experienceClause[Op.gte] = parseInt(filters.minExperience, 10);
      }
      if (
        filters.maxExperience !== undefined &&
        filters.maxExperience !== ""
      ) {
        experienceClause[Op.lte] = parseInt(filters.maxExperience, 10);
      }
      if (Object.keys(experienceClause).length > 0) {
        andConditions.push({ experienceYears: experienceClause });
      }

      if (
        filters.verifiedOnly === true ||
        filters.verifiedOnly === "true"
      ) {
        andConditions.push({ phoneVerified: true });
      }

      const whereClause =
        andConditions.length > 0 ? { [Op.and]: andConditions } : {};

      // Fetch a wide candidate set so post-filters (service names, rating, price) stay accurate
      const result = await this._getCAListItems(
        whereClause,
        500,
        0,
        [["experienceYears", "DESC"]],
      );

      let data = result.data;

      // Specialization: support comma-separated list (OR match)
      if (filters.specialization) {
        const specs = String(filters.specialization)
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        if (specs.length > 0) {
          data = data.filter((ca) => {
            const haystack = (ca.specialization || "").toLowerCase();
            return specs.some((spec) => haystack.includes(spec));
          });
        }
      }

      if (filters.minRating) {
        const minRating = parseFloat(filters.minRating);
        data = data.filter((ca) => ca.rating >= minRating);
      }

      if (filters.minPrice !== undefined && filters.minPrice !== "") {
        const minPrice = parseInt(filters.minPrice, 10);
        data = data.filter((ca) => {
          const priceValue = this._parsePrice(ca.price);
          return !isNaN(priceValue) && priceValue >= minPrice;
        });
      }

      if (filters.maxPrice !== undefined && filters.maxPrice !== "") {
        const maxPrice = parseInt(filters.maxPrice, 10);
        data = data.filter((ca) => {
          const priceValue = this._parsePrice(ca.price);
          // Keep "Contact for Price" when only a max is set
          return isNaN(priceValue) || priceValue <= maxPrice;
        });
      }

      switch (filters.sortBy) {
        case "rating":
          data.sort((a, b) => b.rating - a.rating);
          break;
        case "experience":
          data.sort(
            (a, b) =>
              this._parseExperienceYears(b.experience) -
              this._parseExperienceYears(a.experience),
          );
          break;
        case "price-low":
          data.sort((a, b) => {
            const pa = this._parsePrice(a.price);
            const pb = this._parsePrice(b.price);
            if (isNaN(pa) && isNaN(pb)) return 0;
            if (isNaN(pa)) return 1;
            if (isNaN(pb)) return -1;
            return pa - pb;
          });
          break;
        case "price-high":
          data.sort((a, b) => {
            const pa = this._parsePrice(a.price);
            const pb = this._parsePrice(b.price);
            if (isNaN(pa) && isNaN(pb)) return 0;
            if (isNaN(pa)) return 1;
            if (isNaN(pb)) return -1;
            return pb - pa;
          });
          break;
        case "relevance":
        default:
          // Prefer higher rating, then more reviews
          data.sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return (b.reviewCount || 0) - (a.reviewCount || 0);
          });
          break;
      }

      const total = data.length;
      const safeLimit = Math.max(1, parseInt(limit, 10) || 50);
      const safePage = Math.max(1, parseInt(page, 10) || 1);
      const offset = (safePage - 1) * safeLimit;
      const paged = data.slice(offset, offset + safeLimit);

      return {
        data: paged,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit) || 0,
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
