'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns to Reviews table
    await queryInterface.addColumn('Reviews', 'serviceRequestId', {
      type: Sequelize.UUID,
      allowNull: true, // Initially nullable for existing data
      references: {
        model: 'service_requests',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('Reviews', 'reviewType', {
      type: Sequelize.ENUM('service', 'communication', 'overall'),
      defaultValue: 'overall'
    });

    await queryInterface.addColumn('Reviews', 'tags', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      defaultValue: []
    });

    await queryInterface.addColumn('Reviews', 'wouldRecommend', {
      type: Sequelize.BOOLEAN,
      allowNull: true
    });

    await queryInterface.addColumn('Reviews', 'response', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('Reviews', 'respondedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add indexes
    await queryInterface.addIndex('Reviews', ['serviceRequestId']);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('Reviews', ['serviceRequestId']);

    // Remove columns
    await queryInterface.removeColumn('Reviews', 'serviceRequestId');
    await queryInterface.removeColumn('Reviews', 'reviewType');
    await queryInterface.removeColumn('Reviews', 'tags');
    await queryInterface.removeColumn('Reviews', 'wouldRecommend');
    await queryInterface.removeColumn('Reviews', 'response');
    await queryInterface.removeColumn('Reviews', 'respondedAt');

    // Drop the enum type if it exists
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Reviews_reviewType";');
  }
};