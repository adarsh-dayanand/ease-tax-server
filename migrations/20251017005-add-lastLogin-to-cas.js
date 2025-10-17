"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add lastLogin column
    await queryInterface.addColumn("CAs", "lastLogin", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add status column
    await queryInterface.addColumn("CAs", "status", {
      type: Sequelize.ENUM(
        "active",
        "inactive",
        "suspended",
        "rejected",
        "pending_registration"
      ),
      defaultValue: "active",
      allowNull: false,
    });

    // Add metadata column
    await queryInterface.addColumn("CAs", "metadata", {
      type: Sequelize.JSONB,
      defaultValue: {},
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("CAs", "lastLogin");
    await queryInterface.removeColumn("CAs", "status");
    await queryInterface.removeColumn("CAs", "metadata");

    // Drop the enum type
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CAs_status";'
    );
  },
};
