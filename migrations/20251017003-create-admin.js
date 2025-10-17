"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Admins", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      googleUid: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      role: {
        type: Sequelize.ENUM("super_admin", "admin", "moderator"),
        defaultValue: "admin",
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "suspended"),
        defaultValue: "active",
        allowNull: false,
      },
      permissions: {
        type: Sequelize.JSONB,
        defaultValue: {
          canManageCAs: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canManageSystem: false,
        },
      },
      lastLogin: {
        type: Sequelize.DATE,
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Admins",
          key: "id",
        },
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes
    await queryInterface.addIndex("Admins", ["email"]);
    await queryInterface.addIndex("Admins", ["googleUid"]);
    await queryInterface.addIndex("Admins", ["status"]);
    await queryInterface.addIndex("Admins", ["role"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Admins");
  },
};
