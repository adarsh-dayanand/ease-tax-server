"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove deprecated columns from service_requests table
    await queryInterface.removeColumn("service_requests", "estimatedAmount");
    await queryInterface.removeColumn("service_requests", "finalAmount");
    await queryInterface.removeColumn("service_requests", "scheduledDate");
    await queryInterface.removeColumn("service_requests", "scheduledTime");
  },

  async down(queryInterface, Sequelize) {
    // Restore columns if migration needs to be rolled back
    await queryInterface.addColumn("service_requests", "estimatedAmount", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn("service_requests", "finalAmount", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn("service_requests", "scheduledDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("service_requests", "scheduledTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },
};

