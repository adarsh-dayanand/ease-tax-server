"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'deleted' to the enum_documents_status enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_documents_status" ADD VALUE 'deleted';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    // In production, you would need to recreate the enum without 'deleted'
    // For now, we'll leave it as is since this is a simple addition
  },
};
