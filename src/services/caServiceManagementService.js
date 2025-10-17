const { CAService, CA, ServiceTemplate } = require("../../models");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class CAServiceManagementService {
  /**
   * Get CA's services
   */
  async getCAServices(caId, includeInactive = false) {
    try {
      const whereClause = { caId };

      if (!includeInactive) {
        whereClause.isActive = true;
      }

      const services = await CAService.findAll({
        where: whereClause,
        order: [["serviceType", "ASC"]],
      });

      return services.map((service) => ({
        id: service.id,
        serviceType: service.serviceType,
        serviceName: service.serviceName,
        description: service.description,
        basePrice: parseFloat(service.basePrice),
        currency: service.currency,
        isActive: service.isActive,
        estimatedDays: service.estimatedDays,
        requirements: service.requirements,
        features: service.features,
        additionalCharges: service.additionalCharges,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      }));
    } catch (error) {
      logger.error("Error getting CA services:", error);
      throw error;
    }
  }

  /**
   * Add or update CA service
   */
  async upsertCAService(caId, serviceData) {
    try {
      const {
        serviceType,
        serviceName,
        description,
        basePrice,
        currency = "INR",
        isActive = true,
        estimatedDays,
        requirements = [],
        features = [],
        additionalCharges = {},
      } = serviceData;

      // Validate CA exists
      const ca = await CA.findByPk(caId);
      if (!ca) {
        throw new Error("CA not found");
      }

      // Check if service already exists
      const existingService = await CAService.findOne({
        where: { caId, serviceType },
      });

      let service;
      if (existingService) {
        // Update existing service
        await existingService.update({
          serviceName,
          description,
          basePrice,
          currency,
          isActive,
          estimatedDays,
          requirements,
          features,
          additionalCharges,
        });
        service = existingService;
      } else {
        // Create new service
        service = await CAService.create({
          caId,
          serviceType,
          serviceName,
          description,
          basePrice,
          currency,
          isActive,
          estimatedDays,
          requirements,
          features,
          additionalCharges,
        });
      }

      return {
        id: service.id,
        serviceType: service.serviceType,
        serviceName: service.serviceName,
        description: service.description,
        basePrice: parseFloat(service.basePrice),
        currency: service.currency,
        isActive: service.isActive,
        estimatedDays: service.estimatedDays,
        requirements: service.requirements,
        features: service.features,
        additionalCharges: service.additionalCharges,
      };
    } catch (error) {
      logger.error("Error upserting CA service:", error);
      throw error;
    }
  }

  /**
   * Delete CA service
   */
  async deleteCAService(caId, serviceId) {
    try {
      const service = await CAService.findOne({
        where: { id: serviceId, caId },
      });

      if (!service) {
        throw new Error("Service not found");
      }

      await service.destroy();
      return { success: true };
    } catch (error) {
      logger.error("Error deleting CA service:", error);
      throw error;
    }
  }

  /**
   * Toggle service active status
   */
  async toggleServiceStatus(caId, serviceId) {
    try {
      const service = await CAService.findOne({
        where: { id: serviceId, caId },
      });

      if (!service) {
        throw new Error("Service not found");
      }

      await service.update({
        isActive: !service.isActive,
      });

      return {
        id: service.id,
        serviceType: service.serviceType,
        serviceName: service.serviceName,
        isActive: service.isActive,
      };
    } catch (error) {
      logger.error("Error toggling service status:", error);
      throw error;
    }
  }

  /**
   * Get service price for a specific service type and CA
   */
  async getServicePrice(caId, serviceType) {
    try {
      const service = await CAService.findOne({
        where: {
          caId,
          serviceType,
          isActive: true,
        },
      });

      if (!service) {
        return null;
      }

      return {
        basePrice: parseFloat(service.basePrice),
        currency: service.currency,
        estimatedDays: service.estimatedDays,
        serviceName: service.serviceName,
        additionalCharges: service.additionalCharges,
      };
    } catch (error) {
      logger.error("Error getting service price:", error);
      throw error;
    }
  }

  /**
   * Bulk update CA services
   */
  async bulkUpdateServices(caId, servicesData) {
    try {
      const results = [];

      for (const serviceData of servicesData) {
        const result = await this.upsertCAService(caId, serviceData);
        results.push(result);
      }

      return results;
    } catch (error) {
      logger.error("Error bulk updating services:", error);
      throw error;
    }
  }

  /**
   * Get service templates from database
   */
  async getServiceTemplates() {
    try {
      const templates = await ServiceTemplate.findAll({
        where: { isActive: true },
        order: [
          ["displayOrder", "ASC"],
          ["serviceName", "ASC"],
        ],
        attributes: [
          "serviceType",
          "serviceName",
          "description",
          "category",
          "defaultBasePrice",
          "priceRange",
          "estimatedDays",
          "requirements",
          "features",
          "suggestedAdditionalCharges",
          "complexity",
          "metadata",
        ],
      });

      return templates.map((template) => ({
        serviceType: template.serviceType,
        serviceName: template.serviceName,
        description: template.description,
        category: template.category,
        defaultBasePrice: template.defaultBasePrice
          ? parseFloat(template.defaultBasePrice)
          : null,
        priceRange: template.priceRange,
        estimatedDays: template.estimatedDays,
        requirements: template.requirements || [],
        features: template.features || [],
        suggestedAdditionalCharges: template.suggestedAdditionalCharges || {},
        complexity: template.complexity,
        metadata: template.metadata || {},
      }));
    } catch (error) {
      logger.error("Error getting service templates:", error);
      throw error;
    }
  }

  /**
   * Get service template by type
   */
  async getServiceTemplateByType(serviceType) {
    try {
      const template = await ServiceTemplate.findOne({
        where: {
          serviceType,
          isActive: true,
        },
        attributes: [
          "serviceType",
          "serviceName",
          "description",
          "category",
          "defaultBasePrice",
          "priceRange",
          "estimatedDays",
          "requirements",
          "features",
          "suggestedAdditionalCharges",
          "complexity",
          "metadata",
        ],
      });

      if (!template) {
        return null;
      }

      return {
        serviceType: template.serviceType,
        serviceName: template.serviceName,
        description: template.description,
        category: template.category,
        defaultBasePrice: template.defaultBasePrice
          ? parseFloat(template.defaultBasePrice)
          : null,
        priceRange: template.priceRange,
        estimatedDays: template.estimatedDays,
        requirements: template.requirements || [],
        features: template.features || [],
        suggestedAdditionalCharges: template.suggestedAdditionalCharges || {},
        complexity: template.complexity,
        metadata: template.metadata || {},
      };
    } catch (error) {
      logger.error("Error getting service template by type:", error);
      throw error;
    }
  }

  /**
   * Initialize CA services from templates
   */
  async initializeCAServicesFromTemplates(caId, selectedTemplates = null) {
    try {
      const ca = await CA.findByPk(caId);
      if (!ca) {
        throw new Error("CA not found");
      }

      // Get templates to initialize
      let templates;
      if (selectedTemplates && selectedTemplates.length > 0) {
        templates = await ServiceTemplate.findAll({
          where: {
            serviceType: { [Op.in]: selectedTemplates },
            isActive: true,
          },
        });
      } else {
        // Initialize with all basic and intermediate templates by default
        templates = await ServiceTemplate.findAll({
          where: {
            complexity: { [Op.in]: ["basic", "intermediate"] },
            isActive: true,
          },
          order: [["displayOrder", "ASC"]],
        });
      }

      const createdServices = [];

      for (const template of templates) {
        // Check if service already exists for this CA
        const existingService = await CAService.findOne({
          where: { caId, serviceType: template.serviceType },
        });

        if (!existingService) {
          // Create new service based on template
          const serviceData = {
            caId,
            serviceType: template.serviceType,
            serviceName: template.serviceName,
            description: template.description,
            basePrice: template.defaultBasePrice || 0,
            estimatedDays: template.estimatedDays,
            requirements: template.requirements || [],
            features: template.features || [],
            additionalCharges: template.suggestedAdditionalCharges || {},
            isActive: true,
          };

          const newService = await CAService.create(serviceData);
          createdServices.push(newService);
        }
      }

      return createdServices.map((service) => ({
        id: service.id,
        serviceType: service.serviceType,
        serviceName: service.serviceName,
        description: service.description,
        basePrice: parseFloat(service.basePrice),
        currency: service.currency,
        isActive: service.isActive,
        estimatedDays: service.estimatedDays,
        requirements: service.requirements,
        features: service.features,
        additionalCharges: service.additionalCharges,
      }));
    } catch (error) {
      logger.error("Error initializing CA services from templates:", error);
      throw error;
    }
  }

  /**
   * Get CA services for public viewing (with basic info)
   */
  async getCAServices(caId, serviceType = null) {
    try {
      const whereClause = { caId };
      if (serviceType) {
        whereClause.serviceType = serviceType;
      }

      const services = await CAService.findAll({
        where: whereClause,
        attributes: [
          "id",
          "serviceType",
          "serviceName",
          "description",
          "basePrice",
          "estimatedDays",
          "requirements",
          "features",
        ],
        order: [["serviceType", "ASC"]],
      });

      return services;
    } catch (error) {
      logger.error("Error getting CA services:", error);
      throw error;
    }
  }

  /**
   * Get specific CA service by type
   */
  async getCAServiceByType(caId, serviceType) {
    try {
      const service = await CAService.findOne({
        where: { caId, serviceType },
        attributes: [
          "id",
          "serviceType",
          "serviceName",
          "description",
          "basePrice",
          "estimatedDays",
          "requirements",
          "features",
          "additionalCharges",
        ],
      });

      return service;
    } catch (error) {
      logger.error("Error getting CA service by type:", error);
      throw error;
    }
  }
}

module.exports = new CAServiceManagementService();
