"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("coupon_usages", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      couponId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "coupons",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      serviceRequestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "service_requests",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      paymentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "payments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      originalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      finalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      usedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("coupon_usages", ["couponId"], {
      name: "coupon_usages_coupon_id",
    });

    await queryInterface.addIndex("coupon_usages", ["userId"], {
      name: "coupon_usages_user_id",
    });

    await queryInterface.addIndex("coupon_usages", ["serviceRequestId"], {
      name: "coupon_usages_service_request_id",
    });

    await queryInterface.addIndex("coupon_usages", ["paymentId"], {
      name: "coupon_usages_payment_id",
    });

    await queryInterface.addIndex("coupon_usages", ["usedAt"], {
      name: "coupon_usages_used_at",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("coupon_usages");
  },
};
