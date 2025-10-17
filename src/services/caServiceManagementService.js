const { CAService, CA, ServiceTemplate, Service } = require("../../models");
const logger = require("../config/logger");
const { Op } = require("sequelize");

class CAServiceManagementService {
  /**
   * Get available master services for CA management (services CA can choose to associate with)
   */
  async getCAServices(caId, includeInactive = false) {
    try {
      // Get all available master services
      const masterServices = await Service.findAll({
        where: { isActive: true },
        attributes: [
          "id",
          "name",
          "description",
          "category",
          "requirements",
          "deliverables",
        ],
        order: [
          ["category", "ASC"],
          ["name", "ASC"],
        ],
      });

      // Get CA's existing service associations
      const caServiceAssociations = await CAService.findAll({
        where: { caId },
        attributes: [
          "serviceId",
          "customPrice",
          "currency",
          "customDuration",
          "experienceLevel",
          "notes",
          "isActive",
        ],
      });

      // Create a map of CA's service configurations
      const caServiceMap = new Map();
      caServiceAssociations.forEach((caService) => {
        caServiceMap.set(caService.serviceId, {
          customPrice: caService.customPrice,
          currency: caService.currency,
          customDuration: caService.customDuration,
          experienceLevel: caService.experienceLevel,
          notes: caService.notes,
          isActive: caService.isActive,
        });
      });

      // Combine master services with CA's association status
      return masterServices.map((service) => {
        const caConfig = caServiceMap.get(service.id);

        return {
          id: service.id,
          name: service.name,
          description: service.description,
          category: service.category,
          requirements: service.requirements || [],
          deliverables: service.deliverables || [],
          // Only indicate if CA has associated with this service
          isAssociated: !!caConfig,
          isConfigured: caConfig?.isActive || false,
        };
      });
    } catch (error) {
      logger.error("Error getting CA services:", error);
      throw error;
    }
  }

  /**
   * Get CA's configured services (for public display and CA's own view)
   */
  async getCAConfiguredServices(caId, includeInactive = false) {
    try {
      const whereClause = { caId };

      if (!includeInactive) {
        whereClause.isActive = true;
      }

      const services = await CAService.findAll({
        where: whereClause,
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
        order: [["createdAt", "DESC"]],
      });

      return services.map((service) => ({
        id: service.id,
        serviceId: service.serviceId,
        serviceName: service.service?.name,
        serviceCategory: service.service?.category,
        serviceDescription: service.service?.description,
        serviceRequirements: service.service?.requirements || [],
        serviceDeliverables: service.service?.deliverables || [],
        customPrice: service.customPrice,
        currency: service.currency,
        customDuration: service.customDuration,
        experienceLevel: service.experienceLevel,
        notes: service.notes,
        isActive: service.isActive,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      }));
    } catch (error) {
      logger.error("Error getting CA configured services:", error);
      throw error;
    }
  }

  /**
   * Associate CA with existing service from master Services table
   */
  async associateCAWithService(caId, serviceData) {
    try {
      const {
        serviceId,
        customPrice,
        customDuration,
        currency = "INR",
        experienceLevel = "intermediate",
        notes,
        isActive = true,
      } = serviceData; // Validate CA exists
      const ca = await CA.findByPk(caId);
      if (!ca) {
        throw new Error("CA not found");
      }

      // Validate Service exists
      const service = await Service.findByPk(serviceId);
      if (!service) {
        throw new Error("Service not found");
      }

      // Check if association already exists
      const existingAssociation = await CAService.findOne({
        where: { caId, serviceId },
      });

      let caService;
      if (existingAssociation) {
        // Update existing association
        await existingAssociation.update({
          customPrice,
          customDuration,
          currency,
          experienceLevel,
          notes,
          isActive,
        });
        caService = existingAssociation;
      } else {
        // Create new association
        caService = await CAService.create({
          caId,
          serviceId,
          customPrice,
          customDuration,
          currency,
          experienceLevel,
          notes,
          isActive,
        });
      }

      // Include service details in response
      await caService.reload({
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
      });

      return {
        id: caService.id,
        serviceId: caService.serviceId,
        serviceName: caService.service?.name,
        serviceCategory: caService.service?.category,
        serviceDescription: caService.service?.description,
        serviceRequirements: caService.service?.requirements || [],
        serviceDeliverables: caService.service?.deliverables || [],
        customPrice: caService.customPrice,
        currency: caService.currency,
        customDuration: caService.customDuration,
        experienceLevel: caService.experienceLevel,
        notes: caService.notes,
        isActive: caService.isActive,
        createdAt: caService.createdAt,
        updatedAt: caService.updatedAt,
      };
    } catch (error) {
      logger.error("Error associating CA with service:", error);
      throw error;
    }
  }

  /**
   * Add or update CA service (legacy method for backward compatibility)
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
  async getCAServicesForPublic(caId) {
    try {
      const configuredServices = await this.getCAConfiguredServices(
        caId,
        false
      );

      return configuredServices.map((service) => ({
        id: service.id,
        serviceName: service.serviceName,
        serviceCategory: service.serviceCategory,
        serviceDescription: service.serviceDescription,
        serviceRequirements: service.serviceRequirements,
        serviceDeliverables: service.serviceDeliverables,
        price: service.customPrice,
        currency: service.currency,
        duration: service.customDuration,
        experienceLevel: service.experienceLevel,
        notes: service.notes,
      }));
    } catch (error) {
      logger.error("Error getting CA services for public:", error);
      throw error;
    }
  }

  /**
   * Get all available services from master Services table
   */
  async getAllAvailableServices() {
    try {
      const services = await Service.findAll({
        where: { isActive: true },
        order: [
          ["category", "ASC"],
          ["name", "ASC"],
        ],
      });

      return services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        category: service.category,
        requirements: service.requirements || [],
        deliverables: service.deliverables || [],
        isActive: service.isActive,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      }));
    } catch (error) {
      logger.error("Error getting available services:", error);
      throw error;
    }
  }

  /**
   * Get specific CA service by serviceId
   */
  async getCAServiceById(caId, serviceId) {
    try {
      const service = await CAService.findOne({
        where: { caId, serviceId },
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
        attributes: [
          "id",
          "serviceId",
          "customPrice",
          "currency",
          "customDuration",
          "experienceLevel",
          "notes",
          "isActive",
        ],
      });

      if (!service) {
        return null;
      }

      return {
        id: service.id,
        serviceId: service.serviceId,
        serviceName: service.service?.name,
        serviceCategory: service.service?.category,
        serviceDescription: service.service?.description,
        serviceRequirements: service.service?.requirements || [],
        serviceDeliverables: service.service?.deliverables || [],
        customPrice: service.customPrice,
        currency: service.currency,
        customDuration: service.customDuration,
        experienceLevel: service.experienceLevel,
        notes: service.notes,
        isActive: service.isActive,
      };
    } catch (error) {
      logger.error("Error getting CA service by serviceId:", error);
      throw error;
    }
  }
}

module.exports = new CAServiceManagementService();
