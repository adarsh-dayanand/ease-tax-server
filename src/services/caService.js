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
const cacheService = require("./cacheService");
const logger = require("../config/logger");
const { Op, QueryTypes } = require("sequelize");

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
                        sequelize.col("caServices.customPrice"),
                      ),
                      "ASC",
                    ]
                  : ["experienceYears", "DESC"], // Default sort by experience
          ],
          include: [
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
          group: ["CA.id", "reviews.id", "caServices.id"],
          subQuery: false,
        });

        // CRITICAL FIX: Get all completion counts in a single query to avoid N+1 problem
        const caIds = rows.map((ca) => ca.id);
        const completionCounts = await ServiceRequest.findAll({
          where: {
            caId: { [Op.in]: caIds },
            status: "completed",
          },
          attributes: [
            "caId",
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          ],
          group: ["caId"],
          raw: true,
        });

        // Create a map for O(1) lookup
        const completionCountMap = new Map();
        completionCounts.forEach((item) => {
          completionCountMap.set(item.caId, parseInt(item.count) || 0);
        });

        // Transform the results and calculate aggregated data
        const transformedCAs = rows.map((ca) => {
          const reviews = ca.reviews || [];
          const caServices = ca.caServices || [];

          // Calculate average rating
          const averageRating =
            reviews.length > 0
              ? reviews.reduce((sum, review) => sum + review.rating, 0) /
                reviews.length
              : 0;

          // Get completed consultations from our map (no extra query!)
          const completedConsultations = completionCountMap.get(ca.id) || 0;

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
            specialization: ca.qualifications?.join(", ") || "Tax Consultant",
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
        });

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
              model: CAType,
              as: "caType",
              attributes: ["id", "type", "name", "description"],
            },
          ],
          attributes: [
            "id",
            "name",
            "status",
            "commissionPercentage",
            "location",
            "profileImage",
            "bio",
            "qualifications",
            "languages",
            "experienceYears",
            "caNumber",
          ],
        });

        if (!ca) {
          return null;
        }

        // Fetch all related data in parallel
        const [
          caServicesResult,
          reviewsResult,
          reviewStats,
          completedFilingsResult,
          ratingDistribution,
        ] = await Promise.all([
          // 1. Services
          CAServiceModel.findAll({
            where: { caId, isActive: true },
            include: [
              {
                model: Service,
                as: "service",
                attributes: [
                  "id",
                  "name",
                  "description",
                  "category",
                  "requirements",
                  "deliverables",
                ],
              },
            ],
          }).catch((err) => {
            logger.warn("Error getting CA services:", err.message);
            return [];
          }),

          // 2. Recent Reviews
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
          }).catch((err) => {
            logger.warn("Error getting CA reviews:", err.message);
            return [];
          }),

          // 3. Review Stats (Count and Average)
          Review.findOne({
            where: { caId },
            attributes: [
              [sequelize.fn("COUNT", sequelize.col("id")), "totalReviews"],
              [sequelize.fn("AVG", sequelize.col("rating")), "avgRating"],
            ],
            raw: true,
          }).catch((err) => {
            logger.warn("Error getting review stats:", err.message);
            return { totalReviews: 0, avgRating: 0 };
          }),

          // 4. Completed Filings
          ServiceRequest.count({
            where: { caId, status: "completed" },
          }).catch((err) => {
            logger.warn("Error getting completed filings count:", err.message);
            return 0;
          }),

          // 5. Rating Distribution
          this.getCARatingDistribution(caId),
        ]);

        const caServices = caServicesResult || [];
        const reviews = reviewsResult || [];
        const totalReviews = parseInt(reviewStats?.totalReviews || 0, 10);
        const averageRating = parseFloat(reviewStats?.avgRating || 0);
        const completedFilings = completedFilingsResult || 0;

        caProfile = {
          id: ca.id,
          name: ca?.name,
          specialization: ca?.qualifications?.join(", ") || "Tax Consultant",
          experience: ca?.experienceYears,
          rating:
            averageRating && !isNaN(averageRating)
              ? Number(averageRating.toFixed(1))
              : 0,
          reviewCount: totalReviews,
          location: ca?.location,
          profileImage: ca?.profileImage,
          verified: ca?.status === "active",
          completedFilings: completedFilings,
          bio: ca?.bio,
          qualifications: ca?.qualifications,
          commission: ca?.commissionPercentage,
          languages: ca?.languages,
          caNumber: ca?.caNumber,
          ratingDistribution: ratingDistribution,
          caType: ca?.caType
            ? {
                id: ca.caType.id,
                name: ca.caType.name,
                description: ca.caType.description,
              }
            : null,
          services:
            caServices.map((caService) => ({
              id: caService.service.id,
              caServiceId: caService.id,
              name: caService.service.name,
              description: caService.service.description,
              category: caService.service.category,
              price: caService.customPrice || null,
              duration: caService.customDuration || null,
              currency: caService.currency || "INR",
              experienceLevel: caService.experienceLevel,
              requirements: caService.service.requirements || [],
              deliverables: caService.service.deliverables || [],
              notes: caService.notes,
            })) || [],
          reviews:
            reviews.map((review) => ({
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
   * Submit a review for a CA
   * @param {string} userId - User ID submitting the review
   * @param {string} caId - CA ID being reviewed
   * @param {string} serviceRequestId - Service request ID
   * @param {number} rating - Rating (1-5)
   * @param {string} review - Review text (optional)
   * @returns {Promise<Object>} Created review
   */
  async submitReview(userId, caId, serviceRequestId, rating, review = null) {
    try {
      // Verify the service request exists and belongs to the user
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
        include: [
          {
            model: CA,
            as: "ca",
            attributes: ["id"],
          },
        ],
      });

      if (!serviceRequest) {
        throw new Error("Service request not found");
      }

      if (serviceRequest.userId !== userId) {
        throw new Error(
          "Unauthorized: Service request does not belong to user",
        );
      }

      if (serviceRequest.caId !== caId) {
        throw new Error("CA ID mismatch");
      }

      // Check if service is completed
      if (serviceRequest.status !== "completed") {
        throw new Error("Can only review completed services");
      }

      // Check if review already exists for this service request
      const existingReview = await Review.findOne({
        where: {
          serviceRequestId,
          userId,
          caId,
        },
      });

      if (existingReview) {
        // Update existing review
        await existingReview.update({
          rating,
          review: review || existingReview.review,
        });

        // Clear cache
        await cacheService.del(cacheService.getCacheKeys().CA_REVIEWS(caId));
        await cacheService.del(cacheService.getCacheKeys().CA_PROFILE(caId));

        return {
          id: existingReview.id,
          rating: existingReview.rating,
          review: existingReview.review,
          createdAt: existingReview.createdAt,
          updatedAt: existingReview.updatedAt,
        };
      }

      // Create new review
      const newReview = await Review.create({
        serviceRequestId,
        caId,
        userId,
        rating,
        review,
        isVerified: true, // Auto-verify reviews for completed services
        reviewType: "overall",
      });

      // Clear cache
      await cacheService.del(cacheService.getCacheKeys().CA_REVIEWS(caId));
      await cacheService.del(cacheService.getCacheKeys().CA_PROFILE(caId));
      await cacheService.del(
        cacheService.getCacheKeys().CA_RATING_DISTRIBUTION(caId),
      );
      await cacheService.del(cacheService.getCacheKeys().CA_DASHBOARD(caId));

      return {
        id: newReview.id,
        rating: newReview.rating,
        review: newReview.review,
        createdAt: newReview.createdAt,
        updatedAt: newReview.updatedAt,
      };
    } catch (error) {
      logger.error("Error submitting review:", error);
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
            specialization: ca.qualifications?.join(", ") || "Tax Consultant",
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
   * Get CA rating distribution (count of each rating from 1-5)
   */
  async getCARatingDistribution(caId) {
    try {
      const cacheKey = cacheService.getCacheKeys().CA_RATING_DISTRIBUTION(caId);
      let ratingDistribution = await cacheService.get(cacheKey);

      if (!ratingDistribution) {
        // Initialize rating distribution with 0 counts for ratings 1-5
        ratingDistribution = [
          { rating: 1, count: 0 },
          { rating: 2, count: 0 },
          { rating: 3, count: 0 },
          { rating: 4, count: 0 },
          { rating: 5, count: 0 },
        ];

        // Get actual rating counts from database using raw SQL query
        // This ensures we get the correct column names
        const ratingCounts = await sequelize.query(
          `SELECT rating::integer, COUNT(id)::integer as count 
           FROM reviews 
           WHERE "caId" = :caId 
           GROUP BY rating
           ORDER BY rating DESC`,
          {
            replacements: { caId },
            type: QueryTypes.SELECT,
          },
        );

        // Log raw results for debugging
        logger.info("Rating counts raw results", {
          ratingCounts,
          caId,
          ratingCountsLength: ratingCounts?.length,
        });

        // Update the distribution with actual counts
        if (ratingCounts && Array.isArray(ratingCounts)) {
          ratingCounts.forEach((item) => {
            // Ensure rating is parsed as integer and count as integer
            const rating =
              item.rating != null ? parseInt(String(item.rating), 10) : null;
            const count =
              item.count != null ? parseInt(String(item.count), 10) : null;

            logger.debug("Processing rating item", {
              rawItem: item,
              rating,
              count,
              ratingType: typeof rating,
              countType: typeof count,
            });

            if (
              rating != null &&
              count != null &&
              !isNaN(rating) &&
              !isNaN(count) &&
              rating >= 1 &&
              rating <= 5
            ) {
              // Find the correct element in the array - ensure both are numbers
              const distributionItem = ratingDistribution.find(
                (dist) => Number(dist.rating) === Number(rating),
              );
              if (distributionItem) {
                distributionItem.count = count;
                logger.debug(`Updated rating ${rating} with count ${count}`, {
                  distributionItem,
                });
              } else {
                logger.error("Could not find distribution item for rating", {
                  rating,
                  ratingDistribution,
                  ratingDistributionTypes: ratingDistribution.map((d) => ({
                    rating: d.rating,
                    type: typeof d.rating,
                  })),
                });
              }
            } else {
              logger.warn("Invalid rating data", { item, rating, count });
            }
          });
        } else {
          logger.warn("Rating counts is not an array", {
            ratingCounts,
            type: typeof ratingCounts,
          });
        }

        logger.debug("Final rating distribution", { ratingDistribution });

        // Cache for 30 minutes
        await cacheService.set(cacheKey, ratingDistribution, 1800);
      }

      // Ensure we always return a valid rating distribution array
      if (!ratingDistribution || !Array.isArray(ratingDistribution)) {
        logger.warn("Invalid rating distribution from cache, reinitializing", {
          ratingDistribution,
        });
        ratingDistribution = [
          { rating: 1, count: 0 },
          { rating: 2, count: 0 },
          { rating: 3, count: 0 },
          { rating: 4, count: 0 },
          { rating: 5, count: 0 },
        ];
      }

      // Ensure all ratings are numbers
      ratingDistribution = ratingDistribution.map((item) => ({
        rating: Number(item.rating),
        count: Number(item.count) || 0,
      }));

      return ratingDistribution;
    } catch (error) {
      logger.error("Error getting CA rating distribution:", error);
      // Return default distribution with 0 counts on error
      return [
        { rating: 1, count: 0 },
        { rating: 2, count: 0 },
        { rating: 3, count: 0 },
        { rating: 4, count: 0 },
        { rating: 5, count: 0 },
      ];
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
        cacheService.del(keys.CA_RATING_DISTRIBUTION(caId)),
        cacheService.delPattern("ca:list:*"),
        cacheService.del(keys.POPULAR_CAS()),
      ]);
    } catch (error) {
      logger.error("Error clearing CA cache:", error);
    }
  }
}

module.exports = new CAService();
