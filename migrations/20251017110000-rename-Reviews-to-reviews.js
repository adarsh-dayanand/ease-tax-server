"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Rename table only if it exists as "Reviews"
    const tableList = await queryInterface.showAllTables();
    if (tableList.includes("Reviews")) {
      await queryInterface.renameTable("Reviews", "reviews");
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Revert table name if needed
    const tableList = await queryInterface.showAllTables();
    if (tableList.includes("reviews")) {
      await queryInterface.renameTable("reviews", "Reviews");
    }
  },
};
