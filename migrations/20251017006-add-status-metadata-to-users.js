"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add status column to Users table
    await queryInterface.addColumn("Users", "status", {
      type: Sequelize.ENUM("active", "inactive", "suspended"),
      defaultValue: "active",
      allowNull: false,
    });

    // Add metadata column to Users table
    await queryInterface.addColumn("Users", "metadata", {
      type: Sequelize.JSONB,
      defaultValue: {},
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Users", "status");
    await queryInterface.removeColumn("Users", "metadata");

    // Drop the enum type
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Users_status";'
    );
  },
};
