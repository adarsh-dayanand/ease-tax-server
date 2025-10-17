const { DataTypes } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    recipientId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    recipientType: {
      type: DataTypes.ENUM('user', 'ca'),
      allowNull: false
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: true // null for system notifications
    },
    senderType: {
      type: DataTypes.ENUM('user', 'ca', 'system'),
      defaultValue: 'system'
    },
    serviceRequestId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ServiceRequests',
        key: 'id'
      }
    },
    notificationType: {
      type: DataTypes.ENUM(
        'consultation_requested',
        'consultation_accepted',
        'consultation_rejected',
        'consultation_cancelled',
        'consultation_completed',
        'payment_successful',
        'payment_failed',
        'payment_refunded',
        'document_uploaded',
        'document_verified',
        'document_rejected',
        'message_received',
        'meeting_scheduled',
        'meeting_reminder',
        'meeting_cancelled',
        'deadline_reminder',
        'escalation_notice',
        'review_request',
        'system_announcement'
      ),
      allowNull: false
    },
    channel: {
      type: DataTypes.ENUM('email', 'sms', 'in_app', 'push'),
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    actionUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    actionText: {
      type: DataTypes.STRING,
      allowNull: true
    },
    templateId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    templateData: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'cancelled'),
      defaultValue: 'pending'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: true // For scheduled notifications
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    externalId: {
      type: DataTypes.STRING,
      allowNull: true // ID from external service (SendGrid, Twilio, etc.)
    },
    externalData: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'notifications',
    timestamps: true,
    indexes: [
      {
        fields: ['recipientId']
      },
      {
        fields: ['recipientType']
      },
      {
        fields: ['serviceRequestId']
      },
      {
        fields: ['notificationType']
      },
      {
        fields: ['channel']
      },
      {
        fields: ['status']
      },
      {
        fields: ['isRead']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['scheduledFor']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.ServiceRequest, {
      foreignKey: 'serviceRequestId',
      as: 'serviceRequest'
    });
    
    // Recipient associations (polymorphic)
    Notification.belongsTo(models.User, {
      foreignKey: 'recipientId',
      constraints: false,
      as: 'recipientUser'
    });
    
    Notification.belongsTo(models.CA, {
      foreignKey: 'recipientId',
      constraints: false,
      as: 'recipientCA'
    });
    
    // Sender associations (polymorphic)
    Notification.belongsTo(models.User, {
      foreignKey: 'senderId',
      constraints: false,
      as: 'senderUser'
    });
    
    Notification.belongsTo(models.CA, {
      foreignKey: 'senderId',
      constraints: false,
      as: 'senderCA'
    });
  };

  // Instance methods
  Notification.prototype.markAsRead = function() {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  };

  Notification.prototype.markAsSent = function() {
    this.status = 'sent';
    this.sentAt = new Date();
    return this.save();
  };

  Notification.prototype.markAsDelivered = function() {
    this.status = 'delivered';
    this.deliveredAt = new Date();
    return this.save();
  };

  Notification.prototype.markAsFailed = function(reason) {
    this.status = 'failed';
    this.failedAt = new Date();
    this.failureReason = reason;
    this.retryCount += 1;
    return this.save();
  };

  Notification.prototype.canRetry = function() {
    return this.status === 'failed' && 
           this.retryCount < this.maxRetries;
  };

  Notification.prototype.isExpired = function() {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  };

  Notification.prototype.isScheduled = function() {
    if (!this.scheduledFor) return false;
    return new Date() < new Date(this.scheduledFor);
  };

  Notification.prototype.shouldSendNow = function() {
    if (this.status !== 'pending') return false;
    if (this.isExpired()) return false;
    if (this.scheduledFor && this.isScheduled()) return false;
    return true;
  };

  // Class methods
  Notification.getUnreadCount = async function(recipientId, recipientType) {
    return await this.count({
      where: {
        recipientId,
        recipientType,
        isRead: false,
        channel: 'in_app'
      }
    });
  };

  Notification.markAllAsRead = async function(recipientId, recipientType) {
    return await this.update(
      {
        isRead: true,
        readAt: new Date()
      },
      {
        where: {
          recipientId,
          recipientType,
          isRead: false,
          channel: 'in_app'
        }
      }
    );
  };

  Notification.getPendingForSending = async function(channel, limit = 100) {
    return await this.findAll({
      where: {
        channel,
        status: 'pending',
        [sequelize.Op.or]: [
          { scheduledFor: null },
          { scheduledFor: { [sequelize.Op.lte]: new Date() } }
        ],
        [sequelize.Op.or]: [
          { expiresAt: null },
          { expiresAt: { [sequelize.Op.gt]: new Date() } }
        ]
      },
      order: [['priority', 'DESC'], ['createdAt', 'ASC']],
      limit
    });
  };

  return Notification;
};