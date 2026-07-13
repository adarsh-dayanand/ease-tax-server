"use strict";

/**
 * Replace fixed ca_types.type ENUM with a free slug STRING, add isActive,
 * and seed Tax Professional + Freelancer when missing.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("ca_types");

    // ENUM → STRING: recreate column via temp column to avoid PG enum lock issues
    if (table.type && table.type.type !== "CHARACTER VARYING") {
      await queryInterface.addColumn("ca_types", "type_slug", {
        type: Sequelize.STRING,
        allowNull: true,
      });

      await queryInterface.sequelize.query(`
        UPDATE ca_types SET type_slug = type::text;
      `);

      await queryInterface.removeColumn("ca_types", "type");
      await queryInterface.renameColumn("ca_types", "type_slug", "type");

      await queryInterface.changeColumn("ca_types", "type", {
        type: Sequelize.STRING,
        allowNull: false,
      });

      // Drop leftover enum type if Postgres created one
      await queryInterface.sequelize
        .query(`DROP TYPE IF EXISTS "enum_ca_types_type";`)
        .catch(() => {});
    }

    // Unique index on slug
    try {
      await queryInterface.addIndex("ca_types", ["type"], {
        unique: true,
        name: "ca_types_type_unique",
      });
    } catch (_) {
      // already exists
    }

    if (!table.isActive) {
      await queryInterface.addColumn("ca_types", "isActive", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    const now = new Date();
    const seeds = [
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        type: "tax-professional",
        name: "Tax Professional",
        description: "Licensed or practicing tax professional who can file ITR",
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        type: "freelancer",
        name: "Freelancer",
        description: "Independent tax filing freelancer",
      },
    ];

    for (const seed of seeds) {
      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM ca_types WHERE type = :type OR id = :id LIMIT 1`,
        {
          replacements: { type: seed.type, id: seed.id },
          type: Sequelize.QueryTypes.SELECT,
        },
      );
      if (!existing || existing.length === 0) {
        await queryInterface.bulkInsert("ca_types", [
          {
            ...seed,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("ca_types", {
      type: ["tax-professional", "freelancer"],
    });

    const table = await queryInterface.describeTable("ca_types");
    if (table.isActive) {
      await queryInterface.removeColumn("ca_types", "isActive");
    }

    try {
      await queryInterface.removeIndex("ca_types", "ca_types_type_unique");
    } catch (_) {
      // ignore
    }

    // Reverting to ENUM is lossy for extra slugs; leave as STRING.
  },
};
