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
        allowNull: true, // Duration in days or hours as specified by CA
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: "INR",
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
