"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add countryCode column to Users table
    await queryInterface.addColumn("Users", "countryCode", {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: "Country code for phone number (e.g., +91 for India)",
    });

    // Add countryCode column to CAs table
    await queryInterface.addColumn("CAs", "countryCode", {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: "Country code for phone number (e.g., +91 for India)",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove countryCode column from Users table
    await queryInterface.removeColumn("Users", "countryCode");

    // Remove countryCode column from CAs table
    await queryInterface.removeColumn("CAs", "countryCode");
  },
};

