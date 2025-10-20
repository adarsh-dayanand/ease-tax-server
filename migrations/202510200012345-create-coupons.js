"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("coupons", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      discountType: {
        type: Sequelize.ENUM("percentage", "fixed"),
        allowNull: false,
        defaultValue: "percentage",
      },
      discountValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      maxDiscountAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      minOrderAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      maxUsageLimit: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      usageCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      maxUsagePerUser: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      validFrom: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      validUntil: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      applicableServiceTypes: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
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

    await queryInterface.addIndex("coupons", ["code"], {
      unique: true,
      name: "coupons_code_unique",
    });

    await queryInterface.addIndex("coupons", ["isActive"], {
      name: "coupons_is_active",
    });

    await queryInterface.addIndex("coupons", ["validFrom", "validUntil"], {
      name: "coupons_validity_dates",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("coupons");
  },
};
