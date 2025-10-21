"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove deprecated columns
    await queryInterface.removeColumn("service_requests", "serviceType");
    await queryInterface.removeColumn("service_requests", "deadline");
    await queryInterface.removeColumn("service_requests", "priority");
    await queryInterface.removeColumn("service_requests", "caResponseDeadline");

    // Add caServiceId foreign key
    await queryInterface.addColumn("service_requests", "caServiceId", {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "CAServices",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("service_requests", "caServiceId");
    await queryInterface.addColumn("service_requests", "serviceType", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "tax_filing",
    });
    await queryInterface.addColumn("service_requests", "deadline", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("service_requests", "priority", {
      type: Sequelize.ENUM("low", "medium", "high", "urgent"),
      defaultValue: "medium",
    });
    await queryInterface.addColumn("service_requests", "caResponseDeadline", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
};
