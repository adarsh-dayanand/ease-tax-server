"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove basePrice, currency, and duration from Services table
    await queryInterface.removeColumn("Services", "basePrice");
    await queryInterface.removeColumn("Services", "currency");
    await queryInterface.removeColumn("Services", "duration");
  },

  async down(queryInterface, Sequelize) {
    // Add back the removed columns
    await queryInterface.addColumn("Services", "basePrice", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn("Services", "currency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "INR",
    });
    await queryInterface.addColumn("Services", "duration", {
      type: Sequelize.INTEGER, // Duration in minutes
      allowNull: true,
    });
  },
};
