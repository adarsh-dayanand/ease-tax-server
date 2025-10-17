'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
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
      payerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      payeeId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'CAs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'INR'
      },
      paymentType: {
        type: Sequelize.ENUM(
          'booking_fee',
          'service_fee',
          'cancellation_fee',
          'refund'
        ),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'completed',
          'failed',
          'refunded',
          'cancelled'
        ),
        defaultValue: 'pending'
      },
      paymentGateway: {
        type: Sequelize.ENUM('razorpay', 'phonepe', 'cashfree', 'stripe'),
        allowNull: true
      },
      gatewayPaymentId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      gatewayOrderId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      transactionReference: {
        type: Sequelize.STRING,
        allowNull: true
      },
      isEscrow: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      escrowReleaseDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      commissionAmount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      commissionPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 8.00
      },
      netAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      paymentDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refundDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refundReason: {
        type: Sequelize.TEXT,
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
      lastRetryAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      paymentMethod: {
        type: Sequelize.STRING,
        allowNull: true
      },
      webhookData: {
        type: Sequelize.JSONB,
        allowNull: true
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
    await queryInterface.addIndex('payments', ['serviceRequestId']);
    await queryInterface.addIndex('payments', ['payerId']);
    await queryInterface.addIndex('payments', ['payeeId']);
    await queryInterface.addIndex('payments', ['status']);
    await queryInterface.addIndex('payments', ['paymentType']);
    await queryInterface.addIndex('payments', ['gatewayPaymentId']);
    await queryInterface.addIndex('payments', ['gatewayOrderId']);
    await queryInterface.addIndex('payments', ['isEscrow']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payments');
  }
};