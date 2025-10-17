const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const CA = sequelize.define("CA", {
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
      allowNull: false,
      unique: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
      type: DataTypes.ENUM(
        "active",
        "inactive",
        "suspended",
        "rejected",
        "pending_registration"
      ),
      defaultValue: "active",
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    qualifications: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: ["Chartered Accountant"],
    },
    languages: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: ["English", "Hindi"],
    },
    experienceYears: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
  });

  CA.associate = (models) => {
    CA.hasMany(models.CASpecialization, {
      foreignKey: "caId",
      as: "specializations",
    });
    CA.hasMany(models.Review, { foreignKey: "caId", as: "reviews" });
    CA.hasMany(models.CAService, {
      foreignKey: "caId",
      as: "caServices",
    });
    CA.hasMany(models.ServiceRequest, {
      foreignKey: "caId",
      as: "serviceRequests",
    });
    CA.belongsToMany(models.Service, {
      through: models.CAService,
      foreignKey: "caId",
      otherKey: "serviceId",
      as: "services",
    });
  };

  return CA;
};
