"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Services", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      category: {
        type: Sequelize.ENUM(
          "tax_filing",
          "tax_planning",
          "gst",
          "audit",
          "consultation",
          "compliance",
          "business_setup"
        ),
        allowNull: false,
      },
      basePrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: "INR",
      },
      duration: {
        type: Sequelize.INTEGER, // Duration in minutes
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      requirements: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },
      deliverables: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Insert default services
    await queryInterface.bulkInsert("Services", [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "ITR Filing",
        description: "Income Tax Return filing for individuals and businesses",
        category: "tax_filing",
        basePrice: 2500.0,
        currency: "INR",
        duration: 180,
        requirements: [
          "PAN Card",
          "Form 16",
          "Bank Statements",
          "Investment Proofs",
        ],
        deliverables: [
          "Filed ITR",
          "Acknowledgment Receipt",
          "Tax Calculation Summary",
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: "GST Filing",
        description: "Goods and Services Tax return filing and compliance",
        category: "gst",
        basePrice: 3000.0,
        currency: "INR",
        duration: 120,
        requirements: [
          "GSTIN",
          "Purchase Invoices",
          "Sales Invoices",
          "Bank Statements",
        ],
        deliverables: [
          "GST Returns Filed",
          "Compliance Certificate",
          "Tax Summary",
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        name: "Tax Planning",
        description: "Strategic tax planning and investment advice",
        category: "tax_planning",
        basePrice: 5000.0,
        currency: "INR",
        duration: 240,
        requirements: [
          "Income Details",
          "Investment Portfolio",
          "Financial Goals",
        ],
        deliverables: [
          "Tax Saving Strategy",
          "Investment Recommendations",
          "Tax Calendar",
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440004",
        name: "Business Consultation",
        description: "General business and financial consultation",
        category: "consultation",
        basePrice: 1500.0,
        currency: "INR",
        duration: 60,
        requirements: ["Business Documents", "Financial Statements"],
        deliverables: ["Consultation Report", "Recommendations", "Action Plan"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440005",
        name: "Company Registration",
        description: "Private Limited Company registration and setup",
        category: "business_setup",
        basePrice: 15000.0,
        currency: "INR",
        duration: 2880, // 2 days
        requirements: ["Director Details", "Address Proof", "DIN/DSC"],
        deliverables: [
          "Certificate of Incorporation",
          "PAN/TAN",
          "Company Documents",
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Services");
  },
};
