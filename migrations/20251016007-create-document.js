'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documents', {
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
      uploadedBy: {
        type: Sequelize.UUID,
        allowNull: false
      },
      uploaderType: {
        type: Sequelize.ENUM('user', 'ca'),
        allowNull: false
      },
      filename: {
        type: Sequelize.STRING,
        allowNull: false
      },
      originalName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      fileType: {
        type: Sequelize.ENUM(
          'form16',
          'bank_statement',
          'pan_card',
          'aadhar_card',
          'itr_form',
          'itr_v',
          'other'
        ),
        allowNull: false
      },
      mimeType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      fileSize: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      storageUrl: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      storageProvider: {
        type: Sequelize.ENUM('google_drive', 's3', 'local'),
        defaultValue: 'google_drive'
      },
      isEncrypted: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      encryptionKey: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('uploaded', 'verified', 'rejected', 'processing'),
        defaultValue: 'uploaded'
      },
      verifiedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'CAs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      verifiedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejectionReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      downloadCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      lastAccessedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true
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
    await queryInterface.addIndex('documents', ['serviceRequestId']);
    await queryInterface.addIndex('documents', ['uploadedBy']);
    await queryInterface.addIndex('documents', ['fileType']);
    await queryInterface.addIndex('documents', ['status']);
    await queryInterface.addIndex('documents', ['uploaderType']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('documents');
  }
};