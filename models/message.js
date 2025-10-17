const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define("Message", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    serviceRequestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ServiceRequests',
        key: 'id'
      }
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    senderType: {
      type: DataTypes.ENUM('user', 'ca', 'system'),
      allowNull: false
    },
    receiverId: {
      type: DataTypes.UUID,
      allowNull: true // null for system messages
    },
    receiverType: {
      type: DataTypes.ENUM('user', 'ca'),
      allowNull: true
    },
    messageType: {
      type: DataTypes.ENUM('text', 'file', 'image', 'system'),
      defaultValue: 'text'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    attachmentUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    attachmentType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    attachmentSize: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    attachmentName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isDelivered: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    originalContent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deletedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    replyToMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Messages',
        key: 'id'
      }
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    indexes: [
      {
        fields: ['serviceRequestId']
      },
      {
        fields: ['senderId']
      },
      {
        fields: ['receiverId']
      },
      {
        fields: ['messageType']
      },
      {
        fields: ['isDelivered']
      },
      {
        fields: ['isRead']
      },
      {
        fields: ['isDeleted']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  Message.associate = (models) => {
    Message.belongsTo(models.ServiceRequest, {
      foreignKey: 'serviceRequestId',
      as: 'serviceRequest'
    });
    
    // Sender associations (polymorphic)
    Message.belongsTo(models.User, {
      foreignKey: 'senderId',
      constraints: false,
      as: 'senderUser'
    });
    
    Message.belongsTo(models.CA, {
      foreignKey: 'senderId',
      constraints: false,
      as: 'senderCA'
    });
    
    // Receiver associations (polymorphic)
    Message.belongsTo(models.User, {
      foreignKey: 'receiverId',
      constraints: false,
      as: 'receiverUser'
    });
    
    Message.belongsTo(models.CA, {
      foreignKey: 'receiverId',
      constraints: false,
      as: 'receiverCA'
    });
    
    // Reply association
    Message.belongsTo(models.Message, {
      foreignKey: 'replyToMessageId',
      as: 'replyToMessage'
    });
    
    Message.hasMany(models.Message, {
      foreignKey: 'replyToMessageId',
      as: 'replies'
    });
  };

  // Instance methods
  Message.prototype.markAsDelivered = function() {
    this.isDelivered = true;
    this.deliveredAt = new Date();
    return this.save();
  };

  Message.prototype.markAsRead = function() {
    this.isRead = true;
    this.readAt = new Date();
    if (!this.isDelivered) {
      this.isDelivered = true;
      this.deliveredAt = new Date();
    }
    return this.save();
  };

  Message.prototype.editContent = function(newContent) {
    this.originalContent = this.content;
    this.content = newContent;
    this.isEdited = true;
    this.editedAt = new Date();
    return this.save();
  };

  Message.prototype.softDelete = function(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    return this.save();
  };

  Message.prototype.hasAttachment = function() {
    return this.messageType === 'file' || this.messageType === 'image';
  };

  Message.prototype.isSystemMessage = function() {
    return this.senderType === 'system';
  };

  // Class methods
  Message.getUnreadCount = async function(serviceRequestId, receiverId) {
    return await this.count({
      where: {
        serviceRequestId,
        receiverId,
        isRead: false,
        isDeleted: false
      }
    });
  };

  Message.markAllAsRead = async function(serviceRequestId, receiverId) {
    return await this.update(
      {
        isRead: true,
        readAt: new Date()
      },
      {
        where: {
          serviceRequestId,
          receiverId,
          isRead: false,
          isDeleted: false
        }
      }
    );
  };

  return Message;
};