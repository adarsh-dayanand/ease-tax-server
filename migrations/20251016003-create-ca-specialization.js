"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CASpecializations", {
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
      specialization: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      experience: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fees: {
        type: Sequelize.DECIMAL(10, 2),
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

    // Add index for faster lookups
    await queryInterface.addIndex('CASpecializations', ['caId']);
    await queryInterface.addIndex('CASpecializations', ['specialization']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CASpecializations");
  },
};
