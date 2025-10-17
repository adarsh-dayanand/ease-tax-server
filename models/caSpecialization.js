const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const CASpecialization = sequelize.define("CASpecialization", {
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
      onDelete: "CASCADE",
    },
    specialization: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    experience: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fees: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  });

  CASpecialization.associate = (models) => {
    CASpecialization.belongsTo(models.CA, { foreignKey: "caId", as: "ca" });
  };

  return CASpecialization;
};
