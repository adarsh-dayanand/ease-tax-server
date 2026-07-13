module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Prevent duplicate CA <-> Service associations. The application layer
    // (associateCAWithService) already assumes at most one row per
    // (caId, serviceId) pair via a check-then-act pattern, but without a DB
    // constraint a race (double-click, retry) can create duplicates with
    // divergent pricing. Deduplicate any existing rows first (keep the
    // most recently updated one) so the constraint can be added cleanly.
    await queryInterface.sequelize.query(`
      DELETE FROM "CAServices" a USING "CAServices" b
      WHERE a."caId" = b."caId"
        AND a."serviceId" = b."serviceId"
        AND a."updatedAt" < b."updatedAt"
    `);

    await queryInterface.addConstraint("CAServices", {
      fields: ["caId", "serviceId"],
      type: "unique",
      name: "unique_ca_service",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint("CAServices", "unique_ca_service");
  },
};
