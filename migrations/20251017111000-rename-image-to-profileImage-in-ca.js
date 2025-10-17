"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("CAs", "image", "profileImage");
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("CAs", "profileImage", "image");
  },
};
