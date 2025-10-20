"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add commission percentage to CA table
    await queryInterface.addColumn("CAs", "commissionPercentage", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 8.0,
      comment: "Commission percentage taken by platform from CA's earnings",
    });

    // Add coupon-related fields to payments table
    await queryInterface.addColumn("payments", "couponId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "coupons",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("payments", "discountAmount", {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0.0,
      comment: "Discount amount from coupon",
    });

    await queryInterface.addColumn("payments", "originalAmount", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: "Original amount before discount",
    });

    // Add index for couponId in payments
    await queryInterface.addIndex("payments", ["couponId"], {
      name: "payments_coupon_id",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("CAs", "commissionPercentage");
    await queryInterface.removeIndex("payments", "payments_coupon_id");
    await queryInterface.removeColumn("payments", "couponId");
    await queryInterface.removeColumn("payments", "discountAmount");
    await queryInterface.removeColumn("payments", "originalAmount");
  },
};
