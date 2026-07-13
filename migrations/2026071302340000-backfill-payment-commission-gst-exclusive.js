"use strict";

/**
 * Older payments stored commission/net on the GST-inclusive amount, and
 * booking_fee rows often had commissionAmount=0 / netAmount=null (commission
 * was only calculated for service_fee). Recompute both fields on the
 * GST-exclusive base so they match Payment.calculateCommission / the CA
 * dashboard earnings formula.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE payments
      SET
        "commissionAmount" = ROUND(
          (amount::numeric / 1.18) * (COALESCE("commissionPercentage", 8)::numeric / 100),
          2
        ),
        "netAmount" = ROUND(
          (amount::numeric / 1.18)
            - ROUND(
              (amount::numeric / 1.18) * (COALESCE("commissionPercentage", 8)::numeric / 100),
              2
            ),
          2
        ),
        "updatedAt" = NOW()
      WHERE "paymentType" IN ('service_fee', 'booking_fee')
        AND amount IS NOT NULL
        AND amount > 0;
    `);
  },

  async down(queryInterface) {
    // Cannot reliably restore prior GST-inclusive commission figures.
    // No-op reverse: leave recomputed values in place.
    await queryInterface.sequelize.query(`SELECT 1`);
  },
};
