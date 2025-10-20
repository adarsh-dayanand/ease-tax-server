const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Coupon = sequelize.define(
    "Coupon",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          isUppercase: true,
          notEmpty: true,
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      discountType: {
        type: DataTypes.ENUM("percentage", "fixed"),
        allowNull: false,
        defaultValue: "percentage",
      },
      discountValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      maxDiscountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Maximum discount amount for percentage type coupons",
      },
      minOrderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: "Minimum consultation amount required to apply coupon",
      },
      maxUsageLimit: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment:
          "Total number of times this coupon can be used across all users",
      },
      usageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      maxUsagePerUser: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: "Maximum number of times a single user can use this coupon",
      },
      validFrom: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      validUntil: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      applicableServiceTypes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        comment:
          "Specific service types this coupon applies to. Null means all services",
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: "coupons",
      timestamps: true,
      indexes: [
        {
          fields: ["code"],
          unique: true,
        },
        {
          fields: ["isActive"],
        },
        {
          fields: ["validFrom", "validUntil"],
        },
      ],
    }
  );

  Coupon.associate = (models) => {
    Coupon.hasMany(models.CouponUsage, {
      foreignKey: "couponId",
      as: "usages",
    });
  };

  // Instance methods
  Coupon.prototype.isValid = function () {
    const now = new Date();
    return (
      this.isActive &&
      now >= this.validFrom &&
      now <= this.validUntil &&
      (this.maxUsageLimit === null || this.usageCount < this.maxUsageLimit)
    );
  };

  Coupon.prototype.canBeUsedBy = async function (userId) {
    if (!this.isValid()) return false;

    const CouponUsage = sequelize.models.CouponUsage;
    const userUsageCount = await CouponUsage.count({
      where: {
        couponId: this.id,
        userId: userId,
      },
    });

    return userUsageCount < this.maxUsagePerUser;
  };

  Coupon.prototype.calculateDiscount = function (amount) {
    let discount = 0;

    if (this.discountType === "percentage") {
      discount = (amount * this.discountValue) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = parseFloat(this.maxDiscountAmount);
      }
    } else if (this.discountType === "fixed") {
      discount = parseFloat(this.discountValue);
    }

    // Discount cannot exceed the total amount
    return Math.min(discount, amount);
  };

  return Coupon;
};
