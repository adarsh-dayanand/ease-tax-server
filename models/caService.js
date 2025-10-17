const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const CAService = sequelize.define(
    "CAService",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      caId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "CAs",
          key: "id",
        },
      },
      serviceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Services",
          key: "id",
        },
      },
      customPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // If null, use service base price
        validate: {
          min: 0,
        },
      },
      customDuration: {
        type: DataTypes.INTEGER,
        allowNull: true, // If null, use service base duration
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      experienceLevel: {
        type: DataTypes.ENUM("beginner", "intermediate", "expert"),
        defaultValue: "intermediate",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Legacy fields for backward compatibility
      serviceType: {
        type: DataTypes.ENUM(
          "itr_filing",
          "gst_registration",
          "gst_return_filing",
          "company_registration",
          "trademark_registration",
          "tax_consultation",
          "audit_services",
          "bookkeeping",
          "tds_return",
          "other"
        ),
        allowNull: true, // Making this nullable for new structure
      },
      serviceName: {
        type: DataTypes.STRING,
        allowNull: true, // Making this nullable for new structure
        validate: {
          len: [3, 100],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      basePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Making this nullable for new structure
        validate: {
          min: 0,
        },
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: "INR",
        allowNull: false,
      },
      estimatedDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 365,
        },
      },
      requirements: {
        type: DataTypes.JSONB,
        defaultValue: [],
        validate: {
          isArray(value) {
            if (!Array.isArray(value)) {
              throw new Error("Requirements must be an array");
            }
          },
        },
      },
      features: {
        type: DataTypes.JSONB,
        defaultValue: [],
        validate: {
          isArray(value) {
            if (!Array.isArray(value)) {
              throw new Error("Features must be an array");
            }
          },
        },
      },
      additionalCharges: {
        type: DataTypes.JSONB,
        defaultValue: {},
        validate: {
          isObject(value) {
            if (typeof value !== "object" || Array.isArray(value)) {
              throw new Error("Additional charges must be an object");
            }
          },
        },
      },
    },
    {
      tableName: "CAServices",
      timestamps: true,
      indexes: [
        {
          fields: ["caId"],
        },
        {
          fields: ["serviceType"],
        },
        {
          unique: true,
          fields: ["caId", "serviceType"],
          name: "unique_ca_service_type",
        },
      ],
    }
  );

  // Define associations
  CAService.associate = (models) => {
    CAService.belongsTo(models.CA, {
      foreignKey: "caId",
      as: "ca",
    });
    CAService.belongsTo(models.Service, {
      foreignKey: "serviceId",
      as: "service",
    });
  };

  return CAService;
};
