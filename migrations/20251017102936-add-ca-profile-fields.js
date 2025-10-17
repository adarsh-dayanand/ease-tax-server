"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new fields to CAs table
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

    await queryInterface.addColumn("CAs", "bio", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("CAs", "qualifications", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: ["Chartered Accountant"],
    });

    await queryInterface.addColumn("CAs", "languages", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: ["English"],
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

    await queryInterface.addColumn("CAs", "experienceYears", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeColumn("CAs", "rating");
    await queryInterface.removeColumn("CAs", "reviewCount");
    await queryInterface.removeColumn("CAs", "basePrice");
    await queryInterface.removeColumn("CAs", "currency");
    await queryInterface.removeColumn("CAs", "bio");
    await queryInterface.removeColumn("CAs", "qualifications");
    await queryInterface.removeColumn("CAs", "languages");
    await queryInterface.removeColumn("CAs", "successRate");
    await queryInterface.removeColumn("CAs", "clientRetention");

    await queryInterface.removeColumn("CAs", "experienceYears");
  },
};
