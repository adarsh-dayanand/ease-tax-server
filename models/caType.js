const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const CAType = sequelize.define(
    "CAType",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: "Stable slug e.g. ca, tax-professional, freelancer",
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ca_types",
      timestamps: true,
    },
  );

  CAType.associate = (models) => {
    CAType.hasMany(models.CA, { foreignKey: "caTypeId", as: "cas" });
  };

  return CAType;
};
