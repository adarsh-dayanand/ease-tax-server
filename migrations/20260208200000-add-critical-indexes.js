module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add index for searchCAs completion count query
    await queryInterface.addIndex("service_requests", ["caId", "status"], {
      name: "idx_service_requests_ca_status",
      where: {
        status: "completed",
      },
    });

    // Add index for getUserFilings query
    await queryInterface.addIndex(
      "service_requests",
      ["userId", "status", "completedAt"],
      {
        name: "idx_service_requests_user_status_completed",
        order: [["completedAt", "DESC"]],
      },
    );

    // Add index for notifications query
    await queryInterface.addIndex(
      "notifications",
      ["recipientId", "recipientType", "channel", "isRead", "createdAt"],
      {
        name: "idx_notifications_recipient_channel_read",
        order: [["createdAt", "DESC"]],
      },
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "service_requests",
      "idx_service_requests_ca_status",
    );
    await queryInterface.removeIndex(
      "service_requests",
      "idx_service_requests_user_status_completed",
    );
    await queryInterface.removeIndex(
      "notifications",
      "idx_notifications_recipient_channel_read",
    );
  },
};
