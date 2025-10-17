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
   * CA availability is now handled through consultation requests
   * Users request consultations and CAs respond with available time slots
   */

  /**
   * Request consultation with CA
   * POST /ca/:caId/request
   */
  async requestConsultation(req, res) {
    try {
      const { caId } = req.params;
      const { date, time, purpose, additionalNotes } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!date || !time || !purpose) {
        return res.status(400).json({
          success: false,
          message: "Date, time, and purpose are required",
        });
      }

      // Create service request (this would typically be in a consultation service)
      const ServiceRequest = require("../../models").ServiceRequest;

      const serviceRequest = await ServiceRequest.create({
        userId,
        caId,
        scheduledDate: date,
        scheduledTime: time,
        purpose,
        notes: additionalNotes,
        status: "pending",
        paymentStatus: "unpaid",
        consultationType: "video",
        totalAmount: 2500, // This should come from CA's pricing
        currency: "INR",
      });

      // Clear related caches
      await caService.clearCACache(caId);

      res.status(201).json({
        success: true,
        data: {
          id: serviceRequest.id,
          status: serviceRequest.status,
          message: "Consultation request submitted successfully",
        },
      });
    } catch (error) {
      logger.error("Error in requestConsultation:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
   * Get CA specializations
   * GET /ca/specializations
   */
  async getSpecializations(req, res) {
    try {
      const CASpecialization = require("../../models").CASpecialization;

      const specializations = await CASpecialization.findAll({
        attributes: ["id", "specialization", "experience", "fees", "isActive"],
        order: [["specialization", "ASC"]],
      });

      res.json({
        success: true,
        data: specializations,
      });
    } catch (error) {
      logger.error("Error in getSpecializations:", error);
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
