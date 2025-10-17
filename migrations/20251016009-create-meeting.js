'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('meetings', {
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
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      caId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'CAs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      meetingType: {
        type: Sequelize.ENUM('video', 'phone', 'chat'),
        defaultValue: 'video'
      },
      platform: {
        type: Sequelize.ENUM('google_meet', 'zoom', 'microsoft_teams', 'phone', 'chat'),
        allowNull: true
      },
      scheduledDate: {
        type: Sequelize.DATE,
        allowNull: false
      },
      scheduledTime: {
        type: Sequelize.TIME,
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        defaultValue: 60
      },
      status: {
        type: Sequelize.ENUM(
          'scheduled',
          'rescheduled',
          'cancelled',
          'completed',
          'no_show'
        ),
        defaultValue: 'scheduled'
      },
      meetingLink: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      meetingId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      meetingPassword: {
        type: Sequelize.STRING,
        allowNull: true
      },
      rescheduleCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      maxReschedules: {
        type: Sequelize.INTEGER,
        defaultValue: 2
      },
      rescheduleReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancellationReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancelledBy: {
        type: Sequelize.ENUM('user', 'ca', 'system'),
        allowNull: true
      },
      actualStartTime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      actualEndTime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      actualDuration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      attendees: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      agenda: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      actionItems: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      recordingUrl: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      reminderSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      reminderSentAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      externalPlatformData: {
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
    await queryInterface.addIndex('meetings', ['serviceRequestId']);
    await queryInterface.addIndex('meetings', ['userId']);
    await queryInterface.addIndex('meetings', ['caId']);
    await queryInterface.addIndex('meetings', ['scheduledDate']);
    await queryInterface.addIndex('meetings', ['status']);
    await queryInterface.addIndex('meetings', ['platform']);
    await queryInterface.addIndex('meetings', ['meetingId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('meetings');
  }
};