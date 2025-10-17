"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Only create initial super admin if no admins exist
    const admins = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "Admins"',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (admins[0].count == 0) {
      // Create initial super admin
      await queryInterface.bulkInsert("Admins", [
        {
          id: Sequelize.literal("gen_random_uuid()"),
          name: "System Super Admin",
          email: "passiveincome.adarsh@gmail.com",
          role: "super_admin",
          status: "active",
          permissions: JSON.stringify({
            canManageCAs: true,
            canManageUsers: true,
            canViewAnalytics: true,
            canManageSystem: true,
            canManageAdmins: true,
          }),
          metadata: JSON.stringify({
            isInitialSuperAdmin: true,
            createdVia: "migration",
            note: "Initial system administrator - change email and login via Google Auth",
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the initial super admin created by this migration
    await queryInterface.bulkDelete("Admins", {
      email: "admin@easetax.com",
      metadata: {
        isInitialSuperAdmin: true,
      },
    });
  },
};
