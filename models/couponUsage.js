const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const CouponUsage = sequelize.define(
    "CouponUsage",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      couponId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Coupons",
          key: "id",
        },
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      serviceRequestId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "ServiceRequests",
          key: "id",
        },
      },
      paymentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Payments",
          key: "id",
        },
      },
      originalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Amount before discount",
      },
      discountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Discount amount applied",
      },
      finalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Amount after discount",
      },
      usedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: "coupon_usages",
      timestamps: true,
      indexes: [
        {
          fields: ["couponId"],
        },
        {
          fields: ["userId"],
        },
        {
          fields: ["serviceRequestId"],
        },
        {
          fields: ["paymentId"],
        },
        {
          fields: ["usedAt"],
        },
      ],
    }
  );

  CouponUsage.associate = (models) => {
    CouponUsage.belongsTo(models.Coupon, {
      foreignKey: "couponId",
      as: "coupon",
    });

    CouponUsage.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    CouponUsage.belongsTo(models.ServiceRequest, {
      foreignKey: "serviceRequestId",
      as: "serviceRequest",
    });

    CouponUsage.belongsTo(models.Payment, {
      foreignKey: "paymentId",
      as: "payment",
    });
  };

  return CouponUsage;
};
