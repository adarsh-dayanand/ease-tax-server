const {
  CA,
  CASpecialization,
  CAService: CAServiceModel,
  Service,
  Review,
  ServiceRequest,
  User,
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
        const whereClause = { verified: true }; // Only verified CAs

        if (filters.location) {
          whereClause.location = { [Op.iLike]: `%${filters.location}%` };
        }

        if (filters.specialization) {
          whereClause["$specializations.specialization$"] = {
            [Op.iLike]: `%${filters.specialization}%`,
          };
        }

        const { rows, count } = await CA.findAndCountAll({
          where: whereClause,
          limit,
          offset,
          order: [
            filters.sortBy === "experience"
              ? ["completedFilings", "DESC"]
              : ["completedFilings", "DESC"], // Default sort by experience/completed filings
          ],
          include: [
            {
              model: CASpecialization,
              as: "specializations",
              attributes: ["specialization", "experience"],
            },
          ],
          attributes: [
            "id",
            "name",
            "image",
            "location",
            "completedFilings",
            "verified",
            "phone",
            "email",
            "rating",
            "reviewCount",
            "basePrice",
            "currency",
            "experienceYears",
          ],
        });

        const transformedCAs = rows.map((ca) => ({
          id: ca.id,
          name: ca.name,
          specialization:
            ca.specializations?.map((s) => s.specialization).join(", ") ||
            "Tax Consultant",
          experience: ca.experienceYears
            ? `${ca.experienceYears} years`
            : `${Math.floor(ca.completedFilings / 12) || 1} years`,
          rating: ca.rating || 0.0,
          reviewCount: ca.reviewCount || 0,
          location: ca.location || "India",
          price: `₹${ca.basePrice ? ca.basePrice.toLocaleString("en-IN") : "2,500"}`,
          currency: ca.currency || "INR",
          profileImage: ca.profileImage,
          verified: ca.verified || false,
          completedFilings: ca.completedFilings || 0,
          phone: ca.phone,
          email: ca.email,
        }));

        result = {
          data: transformedCAs,
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
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
        const cas = await User.findAll({
          where: { role: "ca", isActive: true },
          order: [
            ["averageRating", "DESC"],
            ["totalReviews", "DESC"],
            ["completedConsultations", "DESC"],
          ],
          limit,
          include: [
            {
              model: CASpecialization,
              as: "specializations",
              attributes: ["specialization", "experience"],
            },
          ],
          attributes: [
            "id",
            "name",
            "profileImage",
            "location",
            "experienceYears",
            "averageRating",
            "totalReviews",
            "basePrice",
            "currency",
            "isVerified",
            "completedConsultations",
          ],
        });

        popularCAs = cas.map((ca) => ({
          id: ca.id,
          name: ca.name,
          specialization:
            ca.specializations?.map((s) => s.specialization).join(", ") ||
            "Tax Consultant",
          experience: `${ca.experienceYears || 0} years`,
          rating: ca.averageRating || 0,
          reviewCount: ca.totalReviews || 0,
          location: ca.location || "India",
          price: `₹${ca.basePrice || 2500}`,
          image: ca.profileImage,
          verified: ca.isVerified || false,
          completedFilings: ca.completedConsultations || 0,
        }));

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
  getServices(ca) {
    return [
      { name: "ITR Filing", price: `₹${ca.basePrice || 2500}` },
      { name: "Tax Planning", price: `₹${(ca.basePrice || 2500) * 1.5}` },
      { name: "GST Registration", price: `₹${(ca.basePrice || 2500) * 0.8}` },
      {
        name: "Business Consultation",
        price: `₹${(ca.basePrice || 2500) * 2}`,
      },
    ];
  }

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
