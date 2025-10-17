'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      recipientId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      recipientType: {
        type: Sequelize.ENUM('user', 'ca'),
        allowNull: false
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      senderType: {
        type: Sequelize.ENUM('user', 'ca', 'system'),
        defaultValue: 'system'
      },
      serviceRequestId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'service_requests',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      notificationType: {
        type: Sequelize.ENUM(
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
        type: Sequelize.ENUM('email', 'sms', 'in_app', 'push'),
        allowNull: false
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      actionUrl: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      actionText: {
        type: Sequelize.STRING,
        allowNull: true
      },
      templateId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      templateData: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'delivered', 'failed', 'cancelled'),
        defaultValue: 'pending'
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      retryCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      maxRetries: {
        type: Sequelize.INTEGER,
        defaultValue: 3
      },
      scheduledFor: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      externalId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      externalData: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('notifications', ['recipientId']);
    await queryInterface.addIndex('notifications', ['recipientType']);
    await queryInterface.addIndex('notifications', ['serviceRequestId']);
    await queryInterface.addIndex('notifications', ['notificationType']);
    await queryInterface.addIndex('notifications', ['channel']);
    await queryInterface.addIndex('notifications', ['status']);
    await queryInterface.addIndex('notifications', ['isRead']);
    await queryInterface.addIndex('notifications', ['priority']);
    await queryInterface.addIndex('notifications', ['scheduledFor']);
    await queryInterface.addIndex('notifications', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notifications');
  }
};