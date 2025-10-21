"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add currency field to CAServices table if it doesn't exist
    try {
      await queryInterface.addColumn("CAServices", "currency", {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: "INR",
      });
    } catch (error) {
      if (!error.message.includes("already exists")) {
        throw error;
      }
      console.log("Currency column already exists, skipping...");
    }

    // Remove legacy fields that are no longer needed since we use serviceId
    const columnsToRemove = [
      "serviceType",
      "serviceName",
      "description",
      "basePrice",
      "estimatedDays",
      "requirements",
      "features",
      "additionalCharges",
    ];

    for (const column of columnsToRemove) {
      try {
        await queryInterface.removeColumn("CAServices", column);
      } catch (error) {
        // Column might not exist, continue with others
        console.log(`Column ${column} not found, skipping...`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove the currency field
    await queryInterface.removeColumn("CAServices", "currency");

    // Add back the legacy fields
    await queryInterface.addColumn("CAServices", "serviceType", {
      type: Sequelize.ENUM(
        "tax_filing",
        "gst_registration",
        "gst_filing",
        "company_registration",
        "trademark_registration",
        "tax_consultation",
        "audit_services",
        "bookkeeping",
        "tds_return",
        "other"
      ),
      allowNull: true,
    });

    await queryInterface.addColumn("CAServices", "serviceName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("CAServices", "description", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("CAServices", "basePrice", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });

    await queryInterface.addColumn("CAServices", "estimatedDays", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("CAServices", "requirements", {
      type: Sequelize.JSONB,
      defaultValue: [],
    });

    await queryInterface.addColumn("CAServices", "features", {
      type: Sequelize.JSONB,
      defaultValue: [],
    });

    await queryInterface.addColumn("CAServices", "additionalCharges", {
      type: Sequelize.JSONB,
      defaultValue: {},
    });
  },
};
