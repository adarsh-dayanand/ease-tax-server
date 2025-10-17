const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      serviceRequestId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "ServiceRequests",
          key: "id",
        },
      },
      payerId: {
        type: DataTypes.UUID,
        allowNull: false, // Usually user, but can be system for refunds
      },
      payeeId: {
        type: DataTypes.UUID,
        allowNull: true, // CA for service fees, null for booking fees
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: "INR",
      },
      paymentType: {
        type: DataTypes.ENUM(
          "booking_fee",
          "service_fee",
          "cancellation_fee",
          "refund"
        ),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "completed",
          "failed",
          "refunded",
          "cancelled"
        ),
        defaultValue: "pending",
      },
      paymentGateway: {
        type: DataTypes.ENUM("razorpay", "phonepe", "cashfree", "stripe"),
        allowNull: true,
      },
      gatewayPaymentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gatewayOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      transactionReference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isEscrow: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      escrowReleaseDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      commissionAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      commissionPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 8.0, // 8% commission
      },
      netAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Amount after commission deduction
      },
      paymentDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      refundDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      refundReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      failureReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      retryCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lastRetryAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true, // card, netbanking, upi, wallet, etc.
      },
      webhookData: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: "payments",
      timestamps: true,
      indexes: [
        {
          fields: ["serviceRequestId"],
        },
        {
          fields: ["payerId"],
        },
        {
          fields: ["payeeId"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["paymentType"],
        },
        {
          fields: ["gatewayPaymentId"],
        },
        {
          fields: ["gatewayOrderId"],
        },
        {
          fields: ["isEscrow"],
        },
      ],
    }
  );

  Payment.associate = (models) => {
    Payment.belongsTo(models.ServiceRequest, {
      foreignKey: "serviceRequestId",
      as: "serviceRequest",
    });

    Payment.belongsTo(models.User, {
      foreignKey: "payerId",
      as: "payer",
    });

    Payment.belongsTo(models.CA, {
      foreignKey: "payeeId",
      as: "payee",
    });
  };

  // Instance methods
  Payment.prototype.calculateCommission = function () {
    if (this.paymentType === "service_fee") {
      this.commissionAmount = (
        (this.amount * this.commissionPercentage) /
        100
      ).toFixed(2);
      this.netAmount = (this.amount - this.commissionAmount).toFixed(2);
    }
    return this;
  };

  Payment.prototype.isRefundable = function () {
    return (
      this.status === "completed" &&
      this.paymentType !== "refund" &&
      !this.refundDate
    );
  };

  Payment.prototype.canRetry = function () {
    return (
      this.status === "failed" &&
      this.retryCount < 3 &&
      this.paymentType !== "refund"
    );
  };

  return Payment;
};
