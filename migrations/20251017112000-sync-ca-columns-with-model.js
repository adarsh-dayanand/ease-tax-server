"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove columns not present in the model
    const columnsToRemove = [
      "verified",
      "completedFilings",
      "rating",
      "reviewCount",
      "basePrice",
      "successRate",
      "clientRetention",
      "currency",
      // Add any other columns that are not in the model
    ];
    for (const col of columnsToRemove) {
      // Only try to remove if exists
      try {
        await queryInterface.removeColumn("CAs", col);
      } catch (e) {
        // Ignore if column does not exist
      }
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Add back the removed columns with full definitions from previous migrations
    await queryInterface.addColumn("CAs", "verified", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn("CAs", "completedFilings", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
    await queryInterface.addColumn("CAs", "rating", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.0,
      validate: {
        min: 0,
        max: 5,
      },
    });
    await queryInterface.addColumn("CAs", "reviewCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("CAs", "basePrice", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 2500.0,
    });
    await queryInterface.addColumn("CAs", "currency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "INR",
    });
    await queryInterface.addColumn("CAs", "successRate", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    });
    await queryInterface.addColumn("CAs", "clientRetention", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    });
  },
};
