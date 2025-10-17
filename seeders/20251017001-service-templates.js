"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "ServiceTemplates",
      [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          serviceType: "itr_filing",
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
            "Capital gains statements (if applicable)",
          ]),
          features: JSON.stringify([
            "ITR preparation and review",
            "Maximum refund calculation",
            "Tax optimization strategies",
            "E-filing with digital signature",
            "ITR-V if required",
            "Acknowledgment receipt",
            "Post-filing support for notices",
          ]),
          suggestedAdditionalCharges: JSON.stringify({
            expedited_filing: {
              amount: 500,
              description: "Rush processing within 2-3 days",
            },
            multiple_income_sources: {
              amount: 1000,
              description: "For income from salary + business + capital gains",
            },
            capital_gains_computation: {
              amount: 1500,
              description: "Detailed capital gains calculation",
            },
            notice_handling: {
              amount: 2000,
              description: "Handling of IT department notices",
            },
          }),
          complexity: "intermediate",
          isActive: true,
          displayOrder: 1,
          metadata: JSON.stringify({
            popularService: true,
            avgCompletionTime: "5-7 days",
            clientSatisfactionRate: "95%",
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          serviceType: "gst_registration",
          serviceName: "GST Registration",
          description:
            "Complete GST registration process for new businesses with end-to-end support",
          category: "Registration",
          defaultBasePrice: 2500.0,
          priceRange: {
            min: 2000,
            max: 5000,
            note: "Price varies based on business type and urgency",
          },
          estimatedDays: 5,
          requirements: [
            "PAN card of business/proprietor",
            "Aadhaar card of applicant",
            "Business address proof",
            "Bank account details",
            "Email ID and mobile number",
            "Incorporation certificate (for companies)",
            "Partnership deed (for partnerships)",
          ],
          features: [
            "GST registration application preparation",
            "Document verification and upload",
            "Application tracking and follow-up",
            "GST certificate download",
            "Login credentials setup",
            "Initial compliance guidance",
          ],
          suggestedAdditionalCharges: {
            urgent_processing: {
              amount: 1000,
              description: "Fast-track processing within 2-3 days",
            },
            multiple_state_registration: {
              amount: 1500,
              description: "Per additional state registration",
            },
            composition_scheme_setup: {
              amount: 500,
              description: "Composition scheme application",
            },
          },
          complexity: "basic",
          isActive: true,
          displayOrder: 2,
          metadata: {
            avgCompletionTime: "3-5 days",
            successRate: "99%",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440003",
          serviceType: "gst_filing",
          serviceName: "GST Return Filing",
          description:
            "Monthly/Quarterly GST return filing with input tax credit optimization",
          category: "Tax Filing",
          defaultBasePrice: 400.0,
          priceRange: {
            min: 300,
            max: 1500,
            note: "Price varies based on transaction volume and complexity",
          },
          estimatedDays: 3,
          requirements: [
            "Sales invoices for the period",
            "Purchase invoices for the period",
            "Credit notes and debit notes",
            "Previous period return acknowledgments",
            "Bank statements",
            "Export/import documents (if applicable)",
          ],
          features: [
            "GSTR-1 preparation and filing",
            "GSTR-3B preparation and filing",
            "Input tax credit optimization",
            "Compliance verification",
            "Online filing and acknowledgment",
            "Monthly filing calendar reminders",
          ],
          suggestedAdditionalCharges: {
            late_fee_handling: {
              amount: 200,
              description: "Late fee payment and filing",
            },
            amendment_returns: {
              amount: 300,
              description: "Amendment of previously filed returns",
            },
            quarterly_returns: {
              amount: 100,
              description: "Additional charge for quarterly filers",
            },
            high_volume_transactions: {
              amount: 500,
              description: "For businesses with 500+ monthly transactions",
            },
          },
          complexity: "basic",
          isActive: true,
          displayOrder: 3,
          metadata: {
            recurringService: true,
            avgCompletionTime: "2-3 days",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440004",
          serviceType: "company_registration",
          serviceName: "Company Registration",
          description:
            "Private Limited Company registration with complete documentation and compliance setup",
          category: "Registration",
          defaultBasePrice: 15000.0,
          priceRange: {
            min: 12000,
            max: 25000,
            note: "Price varies based on complexity and additional services",
          },
          estimatedDays: 15,
          requirements: [
            "Director's PAN and Aadhaar cards",
            "Address proof for registered office",
            "Passport size photographs",
            "Email IDs and mobile numbers",
            "Proposed company name options",
            "Business activity details",
            "Memorandum and Articles of Association draft",
          ],
          features: [
            "Company name reservation (RUN)",
            "Digital signature certificate assistance",
            "MOA & AOA drafting and filing",
            "SPICe+ form filing",
            "PAN and TAN application",
            "Bank account opening support",
            "Compliance calendar setup",
            "Share certificate preparation",
          ],
          suggestedAdditionalCharges: {
            fast_track_processing: {
              amount: 5000,
              description: "Expedited processing within 7-10 days",
            },
            additional_directors: {
              amount: 2000,
              description: "Per additional director beyond 2",
            },
            registered_office_service: {
              amount: 12000,
              description: "Virtual office service for registered address",
            },
            trademark_search: {
              amount: 3000,
              description: "Company name trademark availability search",
            },
          },
          complexity: "advanced",
          isActive: true,
          displayOrder: 4,
          metadata: {
            avgCompletionTime: "10-15 days",
            documentsRequired: 8,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440005",
          serviceType: "tax_planning",
          serviceName: "Tax Planning & Consultation",
          description:
            "Professional tax advice and planning consultation for individuals and businesses",
          category: "Consultation",
          defaultBasePrice: 2500.0,
          priceRange: {
            min: 1500,
            max: 10000,
            note: "Price varies based on consultation depth and business complexity",
          },
          estimatedDays: 2,
          requirements: [
            "Previous year tax returns",
            "Current financial statements",
            "Investment portfolio details",
            "Business income projections",
            "Salary/income certificates",
            "Existing investment proofs",
          ],
          features: [
            "Comprehensive tax planning strategy",
            "Investment advice under Section 80C, 80D",
            "Business structure optimization",
            "Tax-saving opportunity identification",
            "Written consultation report",
            "Follow-up support for 30 days",
          ],
          suggestedAdditionalCharges: {
            detailed_written_report: {
              amount: 1000,
              description: "Comprehensive written tax planning report",
            },
            business_restructuring_advice: {
              amount: 2000,
              description: "Business structure optimization consultation",
            },
            quarterly_follow_up: {
              amount: 800,
              description: "Quarterly review and follow-up sessions",
            },
          },
          complexity: "intermediate",
          isActive: true,
          displayOrder: 5,
          metadata: {
            consultationBased: true,
            avgCompletionTime: "1-2 days",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440006",
          serviceType: "audit_services",
          serviceName: "Internal Audit Services",
          description:
            "Comprehensive internal audit services for businesses and compliance verification",
          category: "Audit & Compliance",
          defaultBasePrice: 25000.0,
          priceRange: {
            min: 15000,
            max: 100000,
            note: "Price varies based on company size and audit scope",
          },
          estimatedDays: 30,
          requirements: [
            "Financial statements and books of accounts",
            "Bank statements and reconciliations",
            "Inventory records and valuations",
            "Fixed asset registers",
            "Statutory compliance records",
            "Previous audit reports",
          ],
          features: [
            "Financial statement audit",
            "Internal control assessment",
            "Compliance verification",
            "Risk assessment and management",
            "Audit report preparation",
            "Management letter with recommendations",
            "Follow-up on audit observations",
          ],
          suggestedAdditionalCharges: {
            statutory_audit: {
              amount: 15000,
              description: "Additional statutory audit requirements",
            },
            tax_audit: {
              amount: 10000,
              description: "Tax audit under Section 44AB",
            },
            management_consultation: {
              amount: 5000,
              description: "Management consultation sessions",
            },
          },
          complexity: "advanced",
          isActive: true,
          displayOrder: 6,
          metadata: {
            avgCompletionTime: "20-30 days",
            requiresOnSite: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440007",
          serviceType: "compliance_check",
          serviceName: "Compliance Health Check",
          description:
            "Comprehensive compliance review and health check for businesses",
          category: "Audit & Compliance",
          defaultBasePrice: 5000.0,
          priceRange: {
            min: 3000,
            max: 15000,
            note: "Price varies based on business size and compliance areas",
          },
          estimatedDays: 7,
          requirements: [
            "GST returns and compliance records",
            "Income tax filings and payments",
            "TDS returns and certificates",
            "Labour law compliance documents",
            "Environmental clearances (if applicable)",
            "Industry-specific licenses",
          ],
          features: [
            "Multi-regulatory compliance review",
            "Gap analysis and risk assessment",
            "Compliance calendar preparation",
            "Penalty and interest calculations",
            "Remedial action plan",
            "Compliance checklist preparation",
          ],
          suggestedAdditionalCharges: {
            sector_specific_compliance: {
              amount: 2000,
              description: "Industry-specific compliance requirements",
            },
            remediation_support: {
              amount: 3000,
              description: "Support in addressing compliance gaps",
            },
            ongoing_monitoring: {
              amount: 1500,
              description: "Monthly compliance monitoring service",
            },
          },
          complexity: "intermediate",
          isActive: true,
          displayOrder: 7,
          metadata: {
            avgCompletionTime: "5-7 days",
            preventiveService: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440008",
          serviceType: "financial_consultation",
          serviceName: "Financial Consultation",
          description:
            "Professional financial advice and business consultation services",
          category: "Consultation",
          defaultBasePrice: 3000.0,
          priceRange: {
            min: 2000,
            max: 12000,
            note: "Price varies based on consultation scope and business needs",
          },
          estimatedDays: 3,
          requirements: [
            "Business financial statements",
            "Cash flow statements",
            "Profit and loss statements",
            "Balance sheet",
            "Business plan or projections",
            "Investment requirements",
          ],
          features: [
            "Financial health assessment",
            "Business viability analysis",
            "Investment advice and planning",
            "Working capital management",
            "Financial restructuring advice",
            "Growth strategy consultation",
            "Risk management planning",
          ],
          suggestedAdditionalCharges: {
            detailed_financial_model: {
              amount: 2000,
              description: "Excel-based financial modeling",
            },
            business_plan_review: {
              amount: 1500,
              description: "Comprehensive business plan evaluation",
            },
            investor_presentation: {
              amount: 2500,
              description: "Investor pitch deck preparation",
            },
          },
          complexity: "intermediate",
          isActive: true,
          displayOrder: 8,
          metadata: {
            avgCompletionTime: "2-3 days",
            consultationBased: true,
          },
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
