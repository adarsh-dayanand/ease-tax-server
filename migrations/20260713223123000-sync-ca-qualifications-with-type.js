"use strict";

/**
 * Align CA.qualifications with their current ca_types.name when qualifications
 * only held a stale professional-type label (e.g. default "Chartered Accountant"
 * after the expert was reassigned to Tax Professional / Freelancer).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "CAs" AS c
      SET
        qualifications = ARRAY[t.name]::varchar[],
        "updatedAt" = NOW()
      FROM ca_types AS t
      WHERE c.ca_type_id = t.id
        AND (
          c.qualifications IS NULL
          OR cardinality(c.qualifications) = 0
          OR (
            cardinality(c.qualifications) = 1
            AND c.qualifications[1] IN (
              SELECT name FROM ca_types
            )
            AND c.qualifications[1] IS DISTINCT FROM t.name
          )
        );
    `);
  },

  async down() {
    // Irreversible data sync
  },
};
