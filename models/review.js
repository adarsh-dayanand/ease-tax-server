const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define("Review", {
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
      onDelete: "CASCADE",
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    review: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reviewType: {
      type: DataTypes.ENUM('service', 'communication', 'overall'),
      defaultValue: 'overall'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    wouldRecommend: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: true // CA's response to the review
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'reviews',
    timestamps: true,
    indexes: [
      {
        fields: ['serviceRequestId']
      },
      {
        fields: ['caId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['rating']
      },
      {
        fields: ['isVerified']
      }
    ]
  });

  Review.associate = (models) => {
    Review.belongsTo(models.ServiceRequest, { 
      foreignKey: "serviceRequestId", 
      as: "serviceRequest" 
    });
    Review.belongsTo(models.CA, { foreignKey: "caId", as: "ca" });
    Review.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return Review;
};
