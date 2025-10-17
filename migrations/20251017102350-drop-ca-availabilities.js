"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop CAAvailabilities table - CAs will handle availability through consultation requests
    await queryInterface.dropTable("CAAvailabilities");
  },

  async down(queryInterface, Sequelize) {
    // Recreate the table if we need to rollback
    await queryInterface.createTable("CAAvailabilities", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      caId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "CAs",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      dayOfWeek: {
        type: Sequelize.ENUM(
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday"
        ),
        allowNull: false,
      },
      startTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
    await queryInterface.addIndex("CAAvailabilities", ["caId"]);
    await queryInterface.addIndex("CAAvailabilities", ["dayOfWeek"]);
    await queryInterface.addIndex("CAAvailabilities", ["isActive"]);
  },
};
