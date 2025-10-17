const caServiceManagementService = require("../services/caServiceManagementService");
const logger = require("../config/logger");

class CAServiceController {
  /**
   * Get CA's services
   * GET /ca-mgmt/services
   */
  async getServices(req, res) {
    try {
      const caId = req.user.id;
      const { include_inactive } = req.query;

      const services = await caServiceManagementService.getCAServices(
        caId,
        include_inactive === "true"
      );

      res.json({
        success: true,
        data: services,
      });
    } catch (error) {
      logger.error("Error in getServices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get services",
      });
    }
  }

  /**
   * Add or update service
   * POST /ca-mgmt/services
   */
  async upsertService(req, res) {
    try {
      const caId = req.user.id;
      const serviceData = req.body;

      // Validate required fields
      const { serviceType, serviceName, basePrice } = serviceData;

      if (!serviceType || !serviceName || !basePrice) {
        return res.status(400).json({
          success: false,
          message: "Service type, name, and base price are required",
        });
      }

      const service = await caServiceManagementService.upsertCAService(
        caId,
        serviceData
      );

      res.json({
        success: true,
        data: service,
        message: "Service updated successfully",
      });
    } catch (error) {
      logger.error("Error in upsertService:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update service",
      });
    }
  }

  /**
   * Delete service
   * DELETE /ca-mgmt/services/:serviceId
   */
  async deleteService(req, res) {
    try {
      const caId = req.user.id;
      const { serviceId } = req.params;

      await caServiceManagementService.deleteCAService(caId, serviceId);

      res.json({
        success: true,
        message: "Service deleted successfully",
      });
    } catch (error) {
      logger.error("Error in deleteService:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete service",
      });
    }
  }

  /**
   * Toggle service status
   * PATCH /ca-mgmt/services/:serviceId/toggle
   */
  async toggleServiceStatus(req, res) {
    try {
      const caId = req.user.id;
      const { serviceId } = req.params;

      const service = await caServiceManagementService.toggleServiceStatus(
        caId,
        serviceId
      );

      res.json({
        success: true,
        data: service,
        message: `Service ${service.isActive ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      logger.error("Error in toggleServiceStatus:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to toggle service status",
      });
    }
  }

  /**
   * Bulk update services
   * PUT /ca-mgmt/services/bulk
   */
  async bulkUpdateServices(req, res) {
    try {
      const caId = req.user.id;
      const { services } = req.body;

      if (!Array.isArray(services)) {
        return res.status(400).json({
          success: false,
          message: "Services must be an array",
        });
      }

      const updatedServices =
        await caServiceManagementService.bulkUpdateServices(caId, services);

      res.json({
        success: true,
        data: updatedServices,
        message: "Services updated successfully",
      });
    } catch (error) {
      logger.error("Error in bulkUpdateServices:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update services",
      });
    }
  }

  /**
   * Get service templates
   * GET /ca-mgmt/services/templates
   */
  async getServiceTemplates(req, res) {
    try {
      const templates = await caServiceManagementService.getServiceTemplates();

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      logger.error("Error in getServiceTemplates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get service templates",
      });
    }
  }

  /**
   * Initialize default services for CA
   * POST /ca-mgmt/services/initialize-defaults
   */
  async initializeDefaultServices(req, res) {
    try {
      const caId = req.user.id;
      const { selectedServices } = req.body; // Allow CA to select which services to initialize

      const services =
        await caServiceManagementService.initializeCAServicesFromTemplates(
          caId,
          selectedServices
        );

      res.json({
        success: true,
        data: services,
        message: "Default services initialized successfully",
      });
    } catch (error) {
      logger.error("Error in initializeDefaultServices:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initialize default services",
      });
    }
  }

  /**
   * Get service pricing for public display
   * GET /ca/:caId/services (public endpoint)
   */
  async getPublicServices(req, res) {
    try {
      const { caId } = req.params;

      const services = await caServiceManagementService.getCAServices(
        caId,
        false
      );

      // Only return public information
      const publicServices = services.map((service) => ({
        id: service.id,
        serviceType: service.serviceType,
        serviceName: service.serviceName,
        description: service.description,
        basePrice: service.basePrice,
        currency: service.currency,
        estimatedDays: service.estimatedDays,
        features: service.features,
        additionalCharges: service.additionalCharges,
      }));

      res.json({
        success: true,
        data: publicServices,
      });
    } catch (error) {
      logger.error("Error in getPublicServices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get services",
      });
    }
  }
}

module.exports = new CAServiceController();
