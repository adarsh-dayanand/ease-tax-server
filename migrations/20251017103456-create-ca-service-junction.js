"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add serviceId column to existing CAServices table
    await queryInterface.addColumn("CAServices", "serviceId", {
      type: Sequelize.UUID,
      allowNull: true, // Initially nullable for migration
      references: {
        model: "Services",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // Add new columns for the junction functionality
    await queryInterface.addColumn("CAServices", "customPrice", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true, // If null, use service base price
    });

    await queryInterface.addColumn("CAServices", "customDuration", {
      type: Sequelize.INTEGER,
      allowNull: true, // If null, use service base duration
    });

    await queryInterface.addColumn("CAServices", "experienceLevel", {
      type: Sequelize.ENUM("beginner", "intermediate", "expert"),
      defaultValue: "intermediate",
    });

    await queryInterface.addColumn("CAServices", "notes", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeColumn("CAServices", "serviceId");
    await queryInterface.removeColumn("CAServices", "customPrice");
    await queryInterface.removeColumn("CAServices", "customDuration");
    await queryInterface.removeColumn("CAServices", "experienceLevel");
    await queryInterface.removeColumn("CAServices", "notes");
  },
};
