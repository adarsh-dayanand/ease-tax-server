"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
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
          model: 'CAs',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      dayOfWeek: {
        type: Sequelize.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
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

    // Add indexes for faster lookups
    await queryInterface.addIndex('CAAvailabilities', ['caId']);
    await queryInterface.addIndex('CAAvailabilities', ['dayOfWeek']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CAAvailabilities");
  },
};
