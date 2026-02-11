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
   * Search and filter CAs with caching
   */
  async searchCAs(filters = {}, page = 1, limit = 10) {
    try {
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
       catch (error) {
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

                .CA_REVIEWS(caId));
        .CA_PROFILE(caId));

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

            .CA_REVIEWS(caId));
      .CA_PROFILE(caId));
      .CA_RATING_DISTRIBUTION(caId),
      );
      .CA_DASHBOARD(caId));

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
      );

        // Sort by rating, reviewCount, completedFilings (consultations)
        popularCAs.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          if (b.reviewCount !== a.reviewCount)
            return b.reviewCount - a.reviewCount;
          return b.completedFilings - a.completedFilings;
        });

        // Take only the requested limit
        popularCAs = popularCAs.slice(0, limit);

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
      ,
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
  
}

module.exports = new CAService();
