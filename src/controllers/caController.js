const caService = require("../services/caService");
const logger = require("../config/logger");

class CAController {
  /**
   * Search and list CAs
   * GET /ca
   */
  async searchCAs(req, res) {
    try {
      const {
        location,
        specialization,
        minRating,
        maxPrice,
        availability,
        sortBy,
        page = 1,
        limit = 10,
      } = req.query;

      const filters = {
        location,
        specialization,
        minRating,
        maxPrice,
        availability,
        sortBy,
      };

      // Remove undefined values
      Object.keys(filters).forEach(
        (key) => filters[key] === undefined && delete filters[key]
      );

      const result = await caService.searchCAs(
        filters,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        filters: result.filters,
      });
    } catch (error) {
      logger.error("Error in searchCAs:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get CA profile details
   * GET /ca/:caId
   */
  async getCAProfile(req, res) {
    try {
      const { caId } = req.params;

      const caProfile = await caService.getCAProfile(caId);

      if (!caProfile) {
        return res.status(404).json({
          success: false,
          message: "CA not found",
        });
      }

      res.json({
        success: true,
        data: caProfile,
      });
    } catch (error) {
      logger.error("Error in getCAProfile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get CA reviews
   * GET /ca/:caId/reviews
   */
  async getCAReviews(req, res) {
    try {
      const { caId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const reviews = await caService.getCAReviews(
        caId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: reviews.data,
        pagination: reviews.pagination,
      });
    } catch (error) {
      logger.error("Error in getCAReviews:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Submit a review for a CA
   * POST /ca/:caId/reviews
   */
  async submitReview(req, res) {
    try {
      const { caId } = req.params;
      const userId = req.user.id; // From auth middleware
      const { serviceRequestId, rating, comment } = req.body;

      // Validate input
      if (!serviceRequestId) {
        return res.status(400).json({
          success: false,
          message: "Service request ID is required",
        });
      }

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }

      const review = await caService.submitReview(
        userId,
        caId,
        serviceRequestId,
        rating,
        comment || null
      );

      res.json({
        success: true,
        message: "Review submitted successfully",
        data: review,
      });
    } catch (error) {
      logger.error("Error in submitReview:", error);
      res.status(error.message.includes("Unauthorized") ? 403 : 500).json({
        success: false,
        message: error.message || "Failed to submit review",
      });
    }
  }

  /**
   * Get popular CAs
   * GET /ca/popular
   */
  async getPopularCAs(req, res) {
    try {
      const { limit = 10 } = req.query;

      const popularCAs = await caService.getPopularCAs(parseInt(limit));

      res.json({
        success: true,
        data: popularCAs,
      });
    } catch (error) {
      logger.error("Error in getPopularCAs:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Clear CA cache (admin only)
   * DELETE /ca/:caId/cache
   */
  async clearCACache(req, res) {
    try {
      const { caId } = req.params;

      // Only admin can clear cache
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      await caService.clearCACache(caId);

      res.json({
        success: true,
        message: "CA cache cleared successfully",
      });
    } catch (error) {
      logger.error("Error in clearCACache:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new CAController();
