const caServiceManagementService = require("../services/caServiceManagementService");
const logger = require("../config/logger");
const { Service } = require("../../models");

/**
 * Map frontend display name to backend enum value
 * Currently maps to old enum values that exist in the database
 * After migration runs, this can be updated to use new enum values
 */
function mapDisplayNameToEnum(displayName) {
  const mapping = {
    "ITR Filing": "tax_filing",
    "GST Registration": "gst_registration",
    "GST Filing": "gst_return_filing",
    "Company Registration": "company_registration",
    "Trademark Registration": "trademark_registration",
    "Tax Consultation": "tax_consultation",
    "Audit Services": "audit_services",
    "Compliance Check": "compliance_check",
    "Financial Consultation": "financial_consultation",
    "Other Services": "other",
  };

  return mapping[displayName] || displayName;
}

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
        include_inactive === "true",
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

      // Handle both old and new service creation patterns
      if (serviceData.serviceId) {
        // New pattern: Associate with existing service from master table
        const { serviceId } = serviceData;

        if (!serviceId) {
          return res.status(400).json({
            success: false,
            message: "Service ID is required",
          });
        }

        const service = await caServiceManagementService.associateCAWithService(
          caId,
          serviceData,
        );

        res.json({
          success: true,
          data: service,
          message: "Service associated successfully",
        });
      } else {
        // Legacy pattern: Create custom service (backward compatibility)
        const { serviceType, serviceName, basePrice } = serviceData;

        if (!serviceType || !serviceName || !basePrice) {
          return res.status(400).json({
            success: false,
            message:
              "Service type, name, and base price are required for custom services",
          });
        }

        const service = await caServiceManagementService.upsertCAService(
          caId,
          serviceData,
        );

        res.json({
          success: true,
          data: service,
          message: "Custom service updated successfully",
        });
      }
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
        serviceId,
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
   * Get all available services from master table
   * GET /ca-mgmt/services/available
   */
  async getAvailableServices(req, res) {
    try {
      const services =
        await caServiceManagementService.getAllAvailableServices();

      res.json({
        success: true,
        data: services,
      });
    } catch (error) {
      logger.error("Error in getAvailableServices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get available services",
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
          selectedServices,
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

      const services =
        await caServiceManagementService.getCAServicesForPublic(caId);

      // Services are already formatted for public display
      const publicServices = services;

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

  /**
   * Get master services list for public display
   * GET /master/services (public endpoint)
   */
  async getMasterServices(req, res) {
    try {
      // Services are already formatted for public display

      const masterServices = [
        { key: "tax_filing", value: "ITR Filing" },
        { key: "gst_registration", value: "GST Registration" },
        { key: "gst_return_filing", value: "GST Filing" },
        { key: "company_registration", value: "Company Registration" },
        { key: "trademark_registration", value: "Trademark Registration" },
        { key: "tax_consultation", value: "Tax Consultation" },
        { key: "audit_services", value: "Audit Services" },
        { key: "compliance_check", value: "Compliance Check" },
        { key: "financial_consultation", value: "Financial Consultation" },
        { key: "other", value: "Other Services" },
      ];

      res.json({
        success: true,
        data: masterServices,
      });
    } catch (error) {
      logger.error("Error in getMasterServices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get services",
      });
    }
  }

  /**
   * Create service for a specific CA
   * POST /ca/:caId/services (authenticated endpoint)
   * Verifies that the authenticated user matches the caId
   */
  async createServiceForCA(req, res) {
    try {
      const { caId } = req.params;
      const serviceData = req.body;

      // Verify the authenticated user matches the caId and is a CA
      if (req.user.id !== caId || req.user.type !== "ca") {
        return res.status(403).json({
          success: false,
          message: "You can only create services for your own CA account",
        });
      }

      // Validate required fields
      if (!serviceData.serviceName || !serviceData.price) {
        return res.status(400).json({
          success: false,
          message: "Service name and price are required",
        });
      }

      // Map frontend display name to backend enum value
      const serviceCategoryEnum = serviceData.serviceCategory
        ? mapDisplayNameToEnum(serviceData.serviceCategory)
        : "tax_filing";

      // Exact name+category match only — never reuse an unrelated master Service
      // by category/name alone (that caused shared updates across CA services).
      let service = await Service.findOne({
        where: {
          category: serviceCategoryEnum,
          name: serviceData.serviceName,
          isActive: true,
        },
      });

      if (!service) {
        try {
          service = await Service.create({
            name: serviceData.serviceName,
            description:
              serviceData.serviceDescription ||
              `Service: ${serviceData.serviceName}`,
            category: serviceCategoryEnum,
            isActive: true,
            requirements: [],
            deliverables: [],
          });
          logger.info(
            `Created new Service: ${serviceData.serviceName} with category: ${serviceCategoryEnum}`,
          );
        } catch (createError) {
          logger.error("Error creating Service:", createError);

          if (createError.message && createError.message.includes("enum")) {
            return res.status(400).json({
              success: false,
              message: `Invalid service category. The category '${serviceCategoryEnum}' is not valid. Please use a valid category from the dropdown.`,
            });
          }

          return res.status(400).json({
            success: false,
            message: `Unable to create or find service: ${createError.message || "Unknown error"}`,
          });
        }
      }

      // Map frontend data to backend format for associateCAWithService.
      // Pass the raw price through (rather than defaulting invalid input to
      // 0/free) so associateCAWithService's validation can reject it.
      const mappedServiceData = {
        serviceId: service.id,
        customPrice: serviceData.price,
        currency: serviceData.currency || "INR",
        customDuration: serviceData.duration || null,
        notes: serviceData.serviceDescription || null,
        isActive: true,
      };

      // Associate CA with the service using the new pattern
      const caService = await caServiceManagementService.associateCAWithService(
        caId,
        mappedServiceData,
      );

      res.json({
        success: true,
        data: caService,
        message: "Service created successfully",
      });
    } catch (error) {
      logger.error("Error in createServiceForCA:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create service",
      });
    }
  }

  /**
   * Update service for a specific CA
   * PUT /ca/:caId/services/:serviceId (authenticated endpoint)
   */
  async updateServiceForCA(req, res) {
    try {
      const { caId, serviceId } = req.params;
      const serviceData = req.body;

      if (req.user.id !== caId || req.user.type !== "ca") {
        return res.status(403).json({
          success: false,
          message: "You can only update services for your own CA account",
        });
      }

      const caService =
        await caServiceManagementService.updateConfiguredCAService(
          caId,
          serviceId,
          serviceData,
        );

      res.json({
        success: true,
        data: {
          id: caService.id,
          serviceName: caService.serviceName,
          serviceCategory: caService.serviceCategory,
          serviceDescription: caService.serviceDescription,
          price: caService.customPrice,
          currency: caService.currency,
          duration: caService.customDuration,
          experienceLevel: caService.experienceLevel,
          notes: caService.notes,
        },
        message: "Service updated successfully",
      });
    } catch (error) {
      logger.error("Error in updateServiceForCA:", error);
      const status =
        error.message === "Service not found"
          ? 404
          : error.message?.includes("already offer")
            ? 409
            : 500;
      res.status(status).json({
        success: false,
        message: error.message || "Failed to update service",
      });
    }
  }

  /**
   * Delete service for a specific CA
   * DELETE /ca/:caId/services/:serviceId (authenticated endpoint)
   */
  async deleteServiceForCA(req, res) {
    try {
      const { caId, serviceId } = req.params;

      if (req.user.id !== caId || req.user.type !== "ca") {
        return res.status(403).json({
          success: false,
          message: "You can only delete services for your own CA account",
        });
      }

      await caServiceManagementService.deleteCAService(caId, serviceId);

      res.json({
        success: true,
        message: "Service deleted successfully",
      });
    } catch (error) {
      logger.error("Error in deleteServiceForCA:", error);
      const status = error.message === "Service not found" ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message || "Failed to delete service",
      });
    }
  }
}
module.exports = new CAServiceController();
