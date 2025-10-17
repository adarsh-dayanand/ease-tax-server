const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define("Service", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM(
        "tax_filing",
        "tax_planning",
        "gst",
        "audit",
        "consultation",
        "compliance",
        "business_setup"
      ),
      allowNull: false,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    requirements: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    deliverables: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
  });

  Service.associate = (models) => {
    Service.belongsToMany(models.CA, {
      through: models.CAService,
      foreignKey: "serviceId",
      otherKey: "caId",
      as: "cas",
    });
    Service.hasMany(models.CAService, {
      foreignKey: "serviceId",
      as: "caServices",
    });
  };

  return Service;
};
