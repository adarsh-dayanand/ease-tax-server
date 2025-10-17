"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ServiceTemplates", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      serviceType: {
        type: Sequelize.ENUM(
          "itr_filing",
          "gst_registration",
          "gst_filing",
          "company_registration",
          "tax_planning",
          "audit_services",
          "compliance_check",
          "financial_consultation"
        ),
        allowNull: false,
        unique: true,
      },
      serviceName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Service category like Tax, Compliance, Registration etc.",
      },
      defaultBasePrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Suggested base price - CAs can customize this",
      },
      priceRange: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Price range object with min and max suggested pricing",
      },
      estimatedDays: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Typical completion time in days",
      },
      requirements: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: "Array of required documents/information",
      },
      features: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: "Array of service features/deliverables",
      },
      suggestedAdditionalCharges: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: "Suggested additional charges with descriptions",
      },
      complexity: {
        type: Sequelize.ENUM("basic", "intermediate", "advanced"),
        allowNull: true,
        defaultValue: "basic",
        comment: "Service complexity level",
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Whether this service template is active",
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Order for displaying services",
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: "Additional metadata for service template",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex("ServiceTemplates", ["serviceType"]);
    await queryInterface.addIndex("ServiceTemplates", ["category"]);
    await queryInterface.addIndex("ServiceTemplates", ["isActive"]);
    await queryInterface.addIndex("ServiceTemplates", ["displayOrder"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ServiceTemplates");
  },
};
