"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add compound index for notifications
    await queryInterface.addIndex(
      "notifications",
      ["recipientId", "recipientType", "channel", "isRead"],
      {
        name: "notifications_recipient_channel_isRead_idx",
      },
    );

    // Add compound index for payments
    await queryInterface.addIndex(
      "payments",
      ["payeeId", "status", "paymentType"],
      {
        name: "payments_payee_status_type_idx",
      },
    );

    // Add compound index for service requests
    await queryInterface.addIndex("service_requests", ["caId", "status"], {
      name: "service_requests_ca_status_idx",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "notifications",
      "notifications_recipient_channel_isRead_idx",
    );
    await queryInterface.removeIndex(
      "payments",
      "payments_payee_status_type_idx",
    );
    await queryInterface.removeIndex(
      "service_requests",
      "service_requests_ca_status_idx",
    );
  },
};
