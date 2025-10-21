"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "ServiceTemplates",
      [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          serviceType: "tax_filing",
          serviceName: "Income Tax Return Filing",
          description:
            "Complete ITR filing service including form preparation, filing, and acknowledgment receipt",
          category: "Tax Filing",
          defaultBasePrice: 3000.0,
          priceRange: JSON.stringify({
            min: 1500,
            max: 8000,
            note: "Price varies based on income sources and complexity",
          }),
          estimatedDays: 7,
          requirements: JSON.stringify([
            "Form 16/16A (if salaried)",
            "Bank statements (12 months)",
            "Investment proofs (80C, 80D, etc.)",
            "Interest certificates",
            "Previous year ITR copy",
            "PAN and Aadhaar cards",
          ]),
          features: JSON.stringify([
            "ITR preparation and review",
            "Maximum refund calculation",
            "Tax optimization strategies",
            "E-filing with digital signature",
            "Acknowledgment receipt",
            "Post-filing support",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            expedited_filing: {
              amount: 500,
              description: "Rush processing within 2-3 days",
            },
            multiple_income_sources: {
              amount: 1000,
              description: "Multiple income sources",
            },
            capital_gains_computation: {
              amount: 1500,
              description: "Capital gains calculation",
            },
          }),
          complexity: "intermediate",
          isActive: true,
          displayOrder: 1,
          metadata: JSON.stringify({
            popularService: true,
            avgCompletionTime: "5-7 days",
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          serviceType: "gst_registration",
          serviceName: "GST Registration",
          description: "Complete GST registration process for new businesses",
          category: "Registration",
          defaultBasePrice: 2500.0,
          priceRange: JSON.stringify({
            min: 2000,
            max: 5000,
            note: "Price varies based on business type",
          }),
          estimatedDays: 5,
          requirements: JSON.stringify([
            "PAN card of business/proprietor",
            "Aadhaar card of applicant",
            "Business address proof",
            "Bank account details",
            "Email ID and mobile number",
          ]),
          features: JSON.stringify([
            "GST registration application",
            "Document verification",
            "Application tracking",
            "GST certificate download",
            "Login credentials setup",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            urgent_processing: {
              amount: 1000,
              description: "Fast-track processing",
            },
            multiple_state_registration: {
              amount: 1500,
              description: "Per additional state",
            },
          }),
          complexity: "basic",
          isActive: true,
          displayOrder: 2,
          metadata: JSON.stringify({
            avgCompletionTime: "3-5 days",
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440003",
          serviceType: "gst_filing",
          serviceName: "GST Return Filing",
          description: "Monthly/Quarterly GST return filing service",
          category: "Tax Filing",
          defaultBasePrice: 400.0,
          priceRange: JSON.stringify({
            min: 300,
            max: 1500,
            note: "Price varies based on transaction volume",
          }),
          estimatedDays: 3,
          requirements: JSON.stringify([
            "Sales invoices for the period",
            "Purchase invoices for the period",
            "Credit notes and debit notes",
            "Previous period acknowledgments",
            "Bank statements",
          ]),
          features: JSON.stringify([
            "GSTR-1 preparation and filing",
            "GSTR-3B preparation and filing",
            "Input tax credit optimization",
            "Compliance verification",
            "Online filing and acknowledgment",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            late_fee_handling: {
              amount: 200,
              description: "Late fee payment and filing",
            },
            amendment_returns: {
              amount: 300,
              description: "Amendment of filed returns",
            },
          }),
          complexity: "basic",
          isActive: true,
          displayOrder: 3,
          metadata: JSON.stringify({
            recurringService: true,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440004",
          serviceType: "company_registration",
          serviceName: "Company Registration",
          description:
            "Private Limited Company registration with complete documentation",
          category: "Registration",
          defaultBasePrice: 15000.0,
          priceRange: JSON.stringify({
            min: 12000,
            max: 25000,
            note: "Price varies based on complexity",
          }),
          estimatedDays: 15,
          requirements: JSON.stringify([
            "Directors PAN and Aadhaar cards",
            "Address proof for registered office",
            "Passport size photographs",
            "Email IDs and mobile numbers",
            "Proposed company name options",
          ]),
          features: JSON.stringify([
            "Company name reservation",
            "Digital signature assistance",
            "MOA & AOA drafting",
            "SPICe+ form filing",
            "PAN and TAN application",
            "Bank account opening support",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            fast_track_processing: {
              amount: 5000,
              description: "Expedited processing",
            },
            additional_directors: {
              amount: 2000,
              description: "Per additional director",
            },
          }),
          complexity: "advanced",
          isActive: true,
          displayOrder: 4,
          metadata: JSON.stringify({
            avgCompletionTime: "10-15 days",
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440005",
          serviceType: "tax_planning",
          serviceName: "Tax Planning & Consultation",
          description: "Professional tax advice and planning consultation",
          category: "Consultation",
          defaultBasePrice: 2500.0,
          priceRange: JSON.stringify({
            min: 1500,
            max: 10000,
            note: "Price varies based on consultation scope",
          }),
          estimatedDays: 2,
          requirements: JSON.stringify([
            "Previous year tax returns",
            "Current financial statements",
            "Investment portfolio details",
            "Business income projections",
            "Salary/income certificates",
          ]),
          features: JSON.stringify([
            "Comprehensive tax planning strategy",
            "Investment advice under 80C, 80D",
            "Business structure optimization",
            "Tax-saving opportunity identification",
            "Written consultation report",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            detailed_written_report: {
              amount: 1000,
              description: "Comprehensive written report",
            },
            business_restructuring_advice: {
              amount: 2000,
              description: "Business optimization",
            },
          }),
          complexity: "intermediate",
          isActive: true,
          displayOrder: 5,
          metadata: JSON.stringify({
            consultationBased: true,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440006",
          serviceType: "audit_services",
          serviceName: "Internal Audit Services",
          description: "Comprehensive internal audit services for businesses",
          category: "Audit & Compliance",
          defaultBasePrice: 25000.0,
          priceRange: JSON.stringify({
            min: 15000,
            max: 100000,
            note: "Price varies based on company size",
          }),
          estimatedDays: 30,
          requirements: JSON.stringify([
            "Financial statements and books",
            "Bank statements and reconciliations",
            "Inventory records and valuations",
            "Fixed asset registers",
            "Statutory compliance records",
          ]),
          features: JSON.stringify([
            "Financial statement audit",
            "Internal control assessment",
            "Compliance verification",
            "Risk assessment",
            "Audit report preparation",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            statutory_audit: {
              amount: 15000,
              description: "Statutory audit requirements",
            },
            tax_audit: {
              amount: 10000,
              description: "Tax audit under Section 44AB",
            },
          }),
          complexity: "advanced",
          isActive: true,
          displayOrder: 6,
          metadata: JSON.stringify({
            requiresOnSite: true,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440007",
          serviceType: "compliance_check",
          serviceName: "Compliance Health Check",
          description: "Comprehensive compliance review for businesses",
          category: "Audit & Compliance",
          defaultBasePrice: 5000.0,
          priceRange: JSON.stringify({
            min: 3000,
            max: 15000,
            note: "Price varies based on business size",
          }),
          estimatedDays: 7,
          requirements: JSON.stringify([
            "GST returns and compliance records",
            "Income tax filings and payments",
            "TDS returns and certificates",
            "Labour law compliance documents",
            "Industry-specific licenses",
          ]),
          features: JSON.stringify([
            "Multi-regulatory compliance review",
            "Gap analysis and risk assessment",
            "Compliance calendar preparation",
            "Penalty calculations",
            "Remedial action plan",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            sector_specific_compliance: {
              amount: 2000,
              description: "Industry-specific requirements",
            },
            remediation_support: {
              amount: 3000,
              description: "Support in addressing gaps",
            },
          }),
          complexity: "intermediate",
          isActive: true,
          displayOrder: 7,
          metadata: JSON.stringify({
            preventiveService: true,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440008",
          serviceType: "financial_consultation",
          serviceName: "Financial Consultation",
          description:
            "Professional financial advice and business consultation",
          category: "Consultation",
          defaultBasePrice: 3000.0,
          priceRange: JSON.stringify({
            min: 2000,
            max: 12000,
            note: "Price varies based on consultation scope",
          }),
          estimatedDays: 3,
          requirements: JSON.stringify([
            "Business financial statements",
            "Cash flow statements",
            "Profit and loss statements",
            "Balance sheet",
            "Business plan or projections",
          ]),
          features: JSON.stringify([
            "Financial health assessment",
            "Business viability analysis",
            "Investment advice and planning",
            "Working capital management",
            "Growth strategy consultation",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            detailed_financial_model: {
              amount: 2000,
              description: "Excel-based financial modeling",
            },
            business_plan_review: {
              amount: 1500,
              description: "Business plan evaluation",
            },
          }),
          complexity: "intermediate",
          isActive: true,
          displayOrder: 8,
          metadata: JSON.stringify({
            consultationBased: true,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("ServiceTemplates", null, {});
  },
};
