'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('service_requests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
        allowNull: true,
        references: {
          model: 'CAs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'accepted',
          'rejected',
          'in_progress',
          'completed',
          'cancelled',
          'escalated'
        ),
        defaultValue: 'pending',
        allowNull: false
      },
      serviceType: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'itr_filing'
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      additionalNotes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      deadline: {
        type: Sequelize.DATE,
        allowNull: true
      },
      scheduledDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      scheduledTime: {
        type: Sequelize.TIME,
        allowNull: true
      },
      estimatedAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      finalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      cancellationReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancellationFeeDue: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      escalatedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      caResponseDeadline: {
        type: Sequelize.DATE,
        allowNull: true
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
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
    await queryInterface.addIndex('service_requests', ['userId']);
    await queryInterface.addIndex('service_requests', ['caId']);
    await queryInterface.addIndex('service_requests', ['status']);
    await queryInterface.addIndex('service_requests', ['deadline']);
    await queryInterface.addIndex('service_requests', ['caResponseDeadline']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('service_requests');
  }
};