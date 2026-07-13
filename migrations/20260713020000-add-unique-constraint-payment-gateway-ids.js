module.exports = {
  up: async (queryInterface, Sequelize) => {
    // gatewayOrderId/gatewayPaymentId only had plain (non-unique) indexes,
    // so nothing at the DB level stopped two Payment rows from ending up
    // tagged with the same Razorpay order/payment ID under a race between
    // the webhook and the client-driven verify call. Postgres unique
    // indexes allow multiple NULLs, so pending payments without a gateway
    // ID yet are unaffected.
    //
    // Existing duplicate gateway IDs (if any) must be resolved manually
    // before this migration can run — it intentionally does not delete
    // payment rows automatically.
    await queryInterface.addIndex("payments", ["gatewayOrderId"], {
      name: "unique_payments_gateway_order_id",
      unique: true,
      where: { gatewayOrderId: { [Sequelize.Op.ne]: null } },
    });

    await queryInterface.addIndex("payments", ["gatewayPaymentId"], {
      name: "unique_payments_gateway_payment_id",
      unique: true,
      where: { gatewayPaymentId: { [Sequelize.Op.ne]: null } },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex(
      "payments",
      "unique_payments_gateway_order_id",
    );
    await queryInterface.removeIndex(
      "payments",
      "unique_payments_gateway_payment_id",
    );
  },
};
