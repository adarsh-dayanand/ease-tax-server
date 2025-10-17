"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CAServices", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      caId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "CAs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      serviceType: {
        type: Sequelize.ENUM(
          "itr_filing",
          "gst_registration",
          "gst_return_filing",
          "company_registration",
          "trademark_registration",
          "tax_consultation",
          "audit_services",
          "bookkeeping",
          "tds_return",
          "other"
        ),
        allowNull: false,
      },
      serviceName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      basePrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: "Base price in INR",
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: "INR",
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      estimatedDays: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Estimated completion time in days",
      },
      requirements: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: "Required documents/information for this service",
      },
      features: {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: "What is included in this service",
      },
      additionalCharges: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: "Additional charges for extra services",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes
    await queryInterface.addIndex("CAServices", ["caId"]);
    await queryInterface.addIndex("CAServices", ["serviceType"]);
    await queryInterface.addIndex("CAServices", ["isActive"]);
    await queryInterface.addIndex("CAServices", ["caId", "serviceType"], {
      unique: true,
      name: "unique_ca_service_type",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CAServices");
  },
};
