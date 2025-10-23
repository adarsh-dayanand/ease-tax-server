"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if ca_number column exists, if not add it
    const caTableDescription = await queryInterface.describeTable("CAs");
    if (!caTableDescription.ca_number) {
      await queryInterface.addColumn("CAs", "ca_number", {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: "Unique CA number identifier",
      });
    }

    // Create ca_types table if it doesn't exist
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("ca_types")) {
      await queryInterface.createTable("ca_types", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        type: {
          type: Sequelize.ENUM("ca", "tax-consultant"),
          defaultValue: "ca",
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });

      // Insert default types
      await queryInterface.bulkInsert("ca_types", [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "ca",
          name: "Chartered Accountant",
          description: "Professional Chartered Accountant",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "tax-consultant",
          name: "Tax Consultant",
          description: "Tax consultation specialist",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    }

    // Add ca_type_id column if not exists
    if (!caTableDescription.ca_type_id) {
      await queryInterface.addColumn("CAs", "ca_type_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "ca_types",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove ca_type_id column from CA table
    await queryInterface.removeColumn("CAs", "ca_type_id");

    // Drop ca_types table
    await queryInterface.dropTable("ca_types");

    // Remove ca_number column from CA table
    await queryInterface.removeColumn("CAs", "ca_number");
  },
};
