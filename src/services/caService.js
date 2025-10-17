const {
  CA,
  CASpecialization,
  CAService: CAServiceModel,
  Service,
  Review,
  ServiceRequest,
  User,
  sequelize,
} = require("../../models");
const cacheService = require("./cacheService");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class CAService {
  /**
   * Search and filter CAs with caching
   */
  async searchCAs(filters = {}, page = 1, limit = 10) {
    try {
      const cacheKey = cacheService
        .getCacheKeys()
        .CA_LIST({ ...filters, page, limit });

      let result = await cacheService.get(cacheKey);

      if (!result) {
        const offset = (page - 1) * limit;

        // Build where clause based on filters for CA model
        const whereClause = { status: "active" }; // Only active CAs

        if (filters.location) {
          whereClause.location = { [Op.iLike]: `%${filters.location}%` };
        }

        if (filters.specialization) {
          whereClause["$specializations.specialization$"] = {
            [Op.iLike]: `%${filters.specialization}%`,
          };
        }

        // Add rating filter if provided
        if (filters.minRating) {
          whereClause["$reviews.rating$"] = {
            [Op.gte]: parseFloat(filters.minRating),
          };
        }

        const { rows, count } = await CA.findAndCountAll({
          where: whereClause,
          limit,
          offset,
          order: [
            filters.sortBy === "rating"
              ? [sequelize.fn("AVG", sequelize.col("reviews.rating")), "DESC"]
              : filters.sortBy === "experience"
                ? ["experienceYears", "DESC"]
                : filters.sortBy === "price"
                  ? [
                      sequelize.fn(
                        "MIN",
                        sequelize.col("caServices.customPrice")
                      ),
                      "ASC",
                    ]
                  : ["experienceYears", "DESC"], // Default sort by experience
          ],
          include: [
            {
              model: CASpecialization,
              as: "specializations",
              attributes: ["specialization", "experience"],
              required: false,
            },
            {
              model: Review,
              as: "reviews",
              attributes: ["rating"],
              required: false,
            },
            {
              model: CAServiceModel,
              as: "caServices",
              attributes: ["customPrice", "currency"],
              where: { isActive: true },
              required: false,
            },
          ],
          attributes: [
            "id",
            "name",
            "profileImage",
            "location",
            "phone",
            "email",
            "experienceYears",
            "bio",
            "qualifications",
            "languages",
          ],
          group: ["CA.id", "specializations.id", "reviews.id", "caServices.id"],
          subQuery: false,
        });

        // Transform the results and calculate aggregated data
        const transformedCAs = await Promise.all(
          rows.map(async (ca) => {
            const reviews = ca.reviews || [];
            const caServices = ca.caServices || [];

            // Calculate average rating
            const averageRating =
              reviews.length > 0
                ? reviews.reduce((sum, review) => sum + review.rating, 0) /
                  reviews.length
                : 0;

            // Get completed consultations count
            const completedConsultations = await ServiceRequest.count({
              where: { caId: ca.id, status: "completed" },
            });

            // Get the lowest custom price or calculate from services
            let basePrice = null; // default
            let currency = "INR";

            if (caServices.length > 0) {
              const prices = caServices
                .map((service) => service.customPrice)
                .filter((price) => price != null);
              if (prices.length > 0) {
                basePrice = Math.min(...prices);
              }
              currency = caServices[0].currency || "INR";
            }

            return {
              id: ca.id,
              name: ca.name,
              specialization:
                ca.specializations?.map((s) => s.specialization).join(", ") ||
                "Tax Consultant",
              experience: `${ca.experienceYears || 0} years`,
              rating: Number(averageRating.toFixed(1)) || 0,
              reviewCount: reviews.length,
              location: ca.location || "India",
              price: `₹${basePrice.toLocaleString("en-IN")}`,
              currency: currency,
              profileImage: ca.profileImage,
              completedFilings: completedConsultations,
              phone: ca.phone,
              email: ca.email,
              bio: ca.bio,
              qualifications: ca.qualifications || [],
              languages: ca.languages || [],
              verified: true, // Only active CAs are shown
            };
          })
        );

        result = {
          data: transformedCAs,
          pagination: {
            page,
            limit,
            total: count.length, // count is an array when using group
            totalPages: Math.ceil(count.length / limit),
          },
          filters: filters,
        };

        // Cache for 10 minutes (CA list changes frequently)
        await cacheService.set(cacheKey, result, 600);
      }

      return result;
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
      const cacheKey = cacheService.getCacheKeys().CA_PROFILE(caId);

      let caProfile = await cacheService.get(cacheKey);

      if (!caProfile) {
        const ca = await CA.findOne({
          where: { id: caId },
          include: [
            {
              model: CASpecialization,
              as: "specializations",
              attributes: ["specialization", "experience"],
            },
            {
              model: Service,
              as: "services",
              through: {
                model: CAServiceModel,
                as: "caService",
                attributes: [
                  "customPrice",
                  "customDuration",
                  "isActive",
                  "experienceLevel",
                  "notes",
                ],
                where: { isActive: true },
              },
              attributes: [
                "id",
                "name",
                "description",
                "category",
                "basePrice",
                "currency",
                "duration",
                "requirements",
                "deliverables",
              ],
              required: false,
            },
          ],
        });

        if (!ca) {
          return null;
        }

        // Get reviews separately - handle case where table doesn't exist
        let reviews = [];
        try {
          reviews = await Review.findAll({
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
          });
        } catch (error) {
          // If reviews table doesn't exist, continue with empty reviews
          logger.warn(
            "Reviews table not found, continuing without reviews:",
            error.message
          );
          reviews = [];
        }

        // Availability will be handled through consultation requests

        caProfile = {
          id: ca.id,
          name: ca.name,
          specialization: ca?.specializations
            ?.map((s) => s.specialization)
            .join(", "),
          experience: ca?.experienceYears
            ? `${ca.experienceYears} years`
            : `${ca.completedFilings || 0} completed filings`,
          rating: ca?.rating || 0.0,
          reviewCount: ca?.reviewCount || reviews?.length,
          location: ca?.location,
          price: `₹${ca?.basePrice}`,
          currency: ca?.currency,
          image: ca?.image,
          verified: ca?.verified || false,
          completedFilings: ca?.completedFilings || 0,
          bio: ca?.bio,
          qualifications: ca?.qualifications,
          languages: ca?.languages,
          successRate: ca?.successRate,
          clientRetention: ca?.clientRetention,
          services:
            ca.services?.map((service) => ({
              id: service.id,
              name: service.name,
              description: service.description,
              category: service.category,
              price: service.caService?.customPrice || service.basePrice,
              duration: service.caService?.customDuration || service.duration,
              currency: service.currency || ca.currency || "INR",
              experienceLevel:
                service.caService?.experienceLevel || "intermediate",
              requirements: service.requirements || [],
              deliverables: service.deliverables || [],
              notes: service.caService?.notes,
            })) || [],
          specialties: ca?.specializations?.map((s) => s.specialization) || [
            "Income Tax",
          ],
          reviews:
            reviews?.map((review) => ({
              id: review.id,
              name: review.user?.name,
              profileImage: review?.user?.profileImage,
              rating: review?.rating,
              date: this.formatDate(review.createdAt),
              comment: review.review,
            })) || [],
        };

        // Cache for 30 minutes
        await cacheService.set(cacheKey, caProfile, 1800);
      }

      return caProfile;
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
      const cacheKey = cacheService.getCacheKeys().CA_REVIEWS(caId);

      let reviews = await cacheService.get(cacheKey);

      if (!reviews) {
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
              attributes: ["id", "name", "profileImage"],
            },
          ],
        });

        reviews = {
          data: rows?.map((review) => ({
            id: review.id,
            name: review?.user?.name || "Anonymous",
            profileImage: review?.user?.profileImage,
            rating: review?.rating,
            date: this.formatDate(review.createdAt),
            comment: review?.comment,
            helpful: review?.helpful || 0,
          })),
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        };

        // Cache for 1 hour
        await cacheService.set(cacheKey, reviews, 3600);
      }

      return reviews;
    } catch (error) {
      logger.error("Error getting CA reviews:", error);
      throw error;
    }
  }

  /**
   * CA availability is now handled through consultation requests
   * Users can request consultations and CAs will respond with their available times
   */

  /**
   * Get popular CAs
   */
  async getPopularCAs(limit = 10) {
    try {
      const cacheKey = cacheService.getCacheKeys().POPULAR_CAS();

      let popularCAs = await cacheService.get(cacheKey);

      if (!popularCAs) {
        // Fetch CAs with their related data
        const cas = await CA.findAll({
          where: { status: "active" },
          include: [
            {
              model: CASpecialization,
              as: "specializations",
              attributes: ["specialization", "experience"],
            },
            {
              model: Review,
              as: "reviews",
              attributes: ["rating"],
              required: false,
            },
            {
              model: ServiceRequest,
              as: "serviceRequests",
              attributes: ["status"],
              where: { status: "completed" },
              required: false,
            },
            {
              model: CAServiceModel,
              as: "caServices",
              attributes: ["customPrice", "currency"],
              where: { isActive: true },
              required: false,
            },
          ],
          attributes: [
            "id",
            "name",
            "profileImage",
            "location",
            "experienceYears",
          ],
          limit: limit * 2, // Get more than needed to ensure we have enough after filtering
        });

        // Process each CA to calculate aggregated stats
        popularCAs = cas.map((ca) => {
          const reviews = ca.reviews || [];
          const completedConsultations = ca.serviceRequests
            ? ca.serviceRequests.length
            : 0;
          const caServices = ca.caServices || [];

          // Calculate average rating
          const averageRating =
            reviews.length > 0
              ? reviews.reduce((sum, review) => sum + review.rating, 0) /
                reviews.length
              : 0;

          // Get the lowest custom price
          const customPrice =
            caServices.length > 0 ??
            Math.min(...caServices?.map((service) => service?.customPrice));

          const currency =
            caServices.length > 0 && caServices[0].currency
              ? caServices[0].currency
              : "INR";

          return {
            id: ca.id,
            name: ca.name,
            specialization:
              ca.specializations?.map((s) => s.specialization).join(", ") ||
              "Tax Consultant",
            experience: `${ca.experienceYears || 0} years`,
            rating: Number(averageRating.toFixed(1)) || 0,
            reviewCount: reviews.length,
            location: ca?.location || "India",
            price: customPrice
              ? `₹${customPrice?.toLocaleString("en-IN")}`
              : "not defined",
            currency: currency,
            profileImage: ca?.profileImage,
            completedFilings: completedConsultations,
          };
        });

        // Sort by rating, reviewCount, completedFilings (consultations)
        popularCAs.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          if (b.reviewCount !== a.reviewCount)
            return b.reviewCount - a.reviewCount;
          return b.completedFilings - a.completedFilings;
        });

        // Take only the requested limit
        popularCAs = popularCAs.slice(0, limit);

        // Cache for 1 hour
        await cacheService.set(cacheKey, popularCAs, 3600);
      }

      return popularCAs;
    } catch (error) {
      logger.error("Error getting popular CAs:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  formatDate(date) {
    const now = new Date();
    const reviewDate = new Date(date);
    const diffTime = Math.abs(now - reviewDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  }

  /**
   * Clear CA related cache
   */
  async clearCACache(caId) {
    try {
      const keys = cacheService.getCacheKeys();
      await Promise.all([
        cacheService.del(keys.CA_PROFILE(caId)),
        cacheService.del(keys.CA_REVIEWS(caId)),

        cacheService.delPattern("ca:list:*"),
        cacheService.del(keys.POPULAR_CAS()),
      ]);
    } catch (error) {
      logger.error("Error clearing CA cache:", error);
    }
  }
}

module.exports = new CAService();
