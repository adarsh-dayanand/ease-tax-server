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
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    completedFilings: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.0,
      validate: {
        min: 0,
        max: 5,
      },
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 2500.0,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "INR",
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
    successRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 95.0,
      validate: {
        min: 0,
        max: 100,
      },
    },
    clientRetention: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 85.0,
      validate: {
        min: 0,
        max: 100,
      },
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
    CA.belongsToMany(models.Service, {
      through: models.CAService,
      foreignKey: "caId",
      otherKey: "serviceId",
      as: "services",
    });
  };

  return CA;
};
