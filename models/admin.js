const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Admin = sequelize.define(
    "Admin",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 100],
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      googleUid: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      role: {
        type: DataTypes.ENUM("super_admin", "admin", "moderator"),
        defaultValue: "admin",
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "suspended"),
        defaultValue: "active",
        allowNull: false,
      },
      permissions: {
        type: DataTypes.JSONB,
        defaultValue: {
          canManageCAs: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canManageSystem: false,
          canManageAdmins: false,
        },
      },
      lastLogin: {
        type: DataTypes.DATE,
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Admins",
          key: "id",
        },
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
    },
    {
      tableName: "Admins",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["email"],
        },
        {
          unique: true,
          fields: ["googleUid"],
          where: {
            googleUid: {
              [sequelize.Sequelize.Op.ne]: null,
            },
          },
        },
        {
          fields: ["status"],
        },
        {
          fields: ["role"],
        },
      ],
    }
  );

  // Define associations
  Admin.associate = (models) => {
    // Self-referential association for createdBy
    Admin.belongsTo(models.Admin, {
      as: "creator",
      foreignKey: "createdBy",
    });

    Admin.hasMany(models.Admin, {
      as: "createdAdmins",
      foreignKey: "createdBy",
    });
  };

  return Admin;
};
