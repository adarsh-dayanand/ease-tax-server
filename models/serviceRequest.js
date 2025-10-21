const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const ServiceRequest = sequelize.define(
    "ServiceRequest",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      caId: {
        type: DataTypes.UUID,
        allowNull: true, // null until CA accepts
        references: {
          model: "CAs",
          key: "id",
        },
      },
      caServiceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "CAServices",
          key: "id",
        },
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "accepted",
          "rejected",
          "in_progress",
          "completed",
          "cancelled",
          "escalated"
        ),
        defaultValue: "pending",
        allowNull: false,
      },
      purpose: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      additionalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      scheduledDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      scheduledTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      estimatedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      finalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      cancellationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cancellationFeeDue: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      escalatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: "service_requests",
      timestamps: true,
      indexes: [
        {
          fields: ["userId"],
        },
        {
          fields: ["caId"],
        },
        {
          fields: ["caServiceId"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  ServiceRequest.associate = (models) => {
    ServiceRequest.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    ServiceRequest.belongsTo(models.CA, {
      foreignKey: "caId",
      as: "ca",
    });
    ServiceRequest.belongsTo(models.CAService, {
      foreignKey: "caServiceId",
      as: "caService",
    });
    ServiceRequest.hasMany(models.Document, {
      foreignKey: "serviceRequestId",
      as: "documents",
    });
    ServiceRequest.hasMany(models.Payment, {
      foreignKey: "serviceRequestId",
      as: "payments",
    });
    ServiceRequest.hasOne(models.Meeting, {
      foreignKey: "serviceRequestId",
      as: "meeting",
    });
    ServiceRequest.hasOne(models.Review, {
      foreignKey: "serviceRequestId",
      as: "review",
    });
    ServiceRequest.hasMany(models.Message, {
      foreignKey: "serviceRequestId",
      as: "messages",
    });
    ServiceRequest.hasMany(models.Notification, {
      foreignKey: "serviceRequestId",
      as: "notifications",
    });
  };

  return ServiceRequest;
};
