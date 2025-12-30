"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add phoneUid to Users table
    await queryInterface.addColumn("Users", "phoneUid", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      comment: "Firebase phone authentication UID",
    });

    // Add phoneUid to CAs table
    await queryInterface.addColumn("CAs", "phoneUid", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      comment: "Firebase phone authentication UID",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Users", "phoneUid");
    await queryInterface.removeColumn("CAs", "phoneUid");
  },
};

