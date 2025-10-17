'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      serviceRequestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'service_requests',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      senderType: {
        type: Sequelize.ENUM('user', 'ca', 'system'),
        allowNull: false
      },
      receiverId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      receiverType: {
        type: Sequelize.ENUM('user', 'ca'),
        allowNull: true
      },
      messageType: {
        type: Sequelize.ENUM('text', 'file', 'image', 'system'),
        defaultValue: 'text'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      attachmentUrl: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      attachmentType: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attachmentSize: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      attachmentName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      isDelivered: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isEdited: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      editedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      originalContent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      deletedBy: {
        type: Sequelize.UUID,
        allowNull: true
      },
      replyToMessageId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'messages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
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
    await queryInterface.addIndex('messages', ['serviceRequestId']);
    await queryInterface.addIndex('messages', ['senderId']);
    await queryInterface.addIndex('messages', ['receiverId']);
    await queryInterface.addIndex('messages', ['messageType']);
    await queryInterface.addIndex('messages', ['isDelivered']);
    await queryInterface.addIndex('messages', ['isRead']);
    await queryInterface.addIndex('messages', ['isDeleted']);
    await queryInterface.addIndex('messages', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('messages');
  }
};