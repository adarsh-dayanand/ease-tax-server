const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Document = sequelize.define(
    "Document",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      serviceRequestId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "ServiceRequests",
          key: "id",
        },
      },
      uploadedBy: {
        type: DataTypes.UUID,
        allowNull: false, // Can be user or CA
      },
      uploaderType: {
        type: DataTypes.ENUM("user", "ca"),
        allowNull: false,
      },
      filename: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      originalName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileType: {
        type: DataTypes.ENUM(
          "form16",
          "bank_statement",
          "pan_card",
          "aadhar_card",
          "itr_form",
          "itr_v",
          "other"
        ),
        allowNull: false,
      },
      mimeType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      storageUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      storageProvider: {
        type: DataTypes.ENUM("google_drive", "s3", "local"),
        defaultValue: "google_drive",
      },
      isEncrypted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      encryptionKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(
          "uploaded",
          "verified",
          "rejected",
          "processing",
          "deleted"
        ),
        defaultValue: "uploaded",
      },
      verifiedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      downloadCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lastAccessedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true, // For temporary files
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: "documents",
      timestamps: true,
      indexes: [
        {
          fields: ["serviceRequestId"],
        },
        {
          fields: ["uploadedBy"],
        },
        {
          fields: ["fileType"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["uploaderType"],
        },
      ],
    }
  );

  Document.associate = (models) => {
    Document.belongsTo(models.ServiceRequest, {
      foreignKey: "serviceRequestId",
      as: "serviceRequest",
    });

    // Polymorphic association for uploader
    Document.belongsTo(models.User, {
      foreignKey: "uploadedBy",
      constraints: false,
      as: "uploaderUser",
    });

    Document.belongsTo(models.CA, {
      foreignKey: "uploadedBy",
      constraints: false,
      as: "uploaderCA",
    });

    // Verifier association
    Document.belongsTo(models.CA, {
      foreignKey: "verifiedBy",
      as: "verifier",
    });
  };

  return Document;
};
