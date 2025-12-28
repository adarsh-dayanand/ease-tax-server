const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    pan: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gstin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    googleUid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "suspended"),
      defaultValue: "active",
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true,
    },
  });

  User.associate = (models) => {
    User.hasMany(models.Review, { foreignKey: "userId", as: "reviews" });
    User.hasMany(models.ServiceRequest, {
      foreignKey: "userId",
      as: "serviceRequests",
    });
    User.hasMany(models.Payment, { foreignKey: "payerId", as: "payments" });
  };

  return User;
};
