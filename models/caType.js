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
        type: DataTypes.ENUM("ca", "tax-consultant"),
        defaultValue: "ca",
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "ca_types",
      timestamps: true,
    }
  );

  CAType.associate = (models) => {
    CAType.hasMany(models.CA, { foreignKey: "caTypeId", as: "cas" });
  };

  return CAType;
};
