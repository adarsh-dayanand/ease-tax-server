// CA Service Management - Usage Examples
// This file demonstrates how CAs can manage their service pricing

const examples = {
  // Example 1: Setting up ITR Filing service at ₹3,000
  itrFilingService: {
    serviceType: "itr_filing",
    serviceName: "ITR Filing Service",
    description: "Complete ITR filing service with expert guidance and tax optimization",
    basePrice: 3000.00,
    estimatedDays: 5,
    requirements: [
      "Form 16/Form 16A",
      "Bank statements (12 months)",
      "Investment proofs (80C, 80D, etc.)",
      "Interest certificates",
      "Previous year ITR copy",
      "PAN and Aadhaar"
    ],
    features: [
      "Expert tax consultation",
      "Document verification",
      "Tax optimization strategies",
      "E-filing with acknowledgment",
      "Refund tracking support",
      "Post-filing support"
    ],
    additionalCharges: {
      "expedited_filing": 500,
      "amendment_filing": 800,
      "capital_gains_computation": 1000,
      "business_income_details": 1500
    }
  },

  // Example 2: Setting up GST Filing service at ₹400
  gstFilingService: {
    serviceType: "gst_filing",
    serviceName: "GST Return Filing",
    description: "Monthly/Quarterly GST return filing with compliance check",
    basePrice: 400.00,
    estimatedDays: 3,
    requirements: [
      "Sales invoices",
      "Purchase invoices", 
      "Credit notes",
      "Debit notes",
      "Previous return acknowledgments",
      "Bank statements"
    ],
    features: [
      "GSTR-1, GSTR-3B preparation",
      "Input tax credit optimization",
      "Compliance verification",
      "Online filing",
      "Acknowledgment receipt",
      "Monthly filing reminders"
    ],
    additionalCharges: {
      "late_fee_handling": 200,
      "amendment_returns": 300,
      "annual_return_gstr9": 2000
    }
  },

  // Example 3: Company Registration service
  companyRegistrationService: {
    serviceType: "company_registration",
    serviceName: "Private Limited Company Registration",
    description: "Complete company incorporation with all legal formalities",
    basePrice: 15000.00,
    estimatedDays: 15,
    requirements: [
      "Director's PAN and Aadhaar",
      "Address proof for registered office",
      "Passport size photos",
      "Director's digital signatures",
      "Memorandum of Association draft",
      "Articles of Association draft"
    ],
    features: [
      "Name reservation (RUN)",
      "Digital signature procurement", 
      "MOA & AOA drafting",
      "Form filing (SPICe+)",
      "PAN & TAN application",
      "Bank account opening support",
      "Compliance calendar setup"
    ],
    additionalCharges: {
      "fast_track_processing": 5000,
      "additional_directors": 2000,
      "registered_office_service": 12000
    }
  },

  // Example API calls for CAs to use

  apiExamples: {
    // 1. Get service templates
    getTemplates: {
      method: "GET",
      url: "/api/ca-mgmt/services/templates",
      headers: {
        "Authorization": "Bearer <ca_jwt_token>"
      }
    },

    // 2. Initialize default services
    initializeDefaults: {
      method: "POST", 
      url: "/api/ca-mgmt/services/initialize-defaults",
      headers: {
        "Authorization": "Bearer <ca_jwt_token>"
      }
    },

    // 3. Create/Update ITR service
    createITRService: {
      method: "POST",
      url: "/api/ca-mgmt/services",
      headers: {
        "Authorization": "Bearer <ca_jwt_token>",
        "Content-Type": "application/json"
      },
      body: {
        serviceType: "itr_filing",
        serviceName: "ITR Filing Service",
        basePrice: 3000.00,
        // ... other fields
      }
    },

    // 4. Bulk update all services
    bulkUpdateServices: {
      method: "POST",
      url: "/api/ca-mgmt/services/bulk-update", 
      headers: {
        "Authorization": "Bearer <ca_jwt_token>",
        "Content-Type": "application/json"
      },
      body: {
        services: [
          { serviceType: "itr_filing", basePrice: 3000.00 },
          { serviceType: "gst_filing", basePrice: 400.00 },
          // ... more services
        ]
      }
    },

    // 5. Get CA's current services
    getMyServices: {
      method: "GET",
      url: "/api/ca-mgmt/services",
      headers: {
        "Authorization": "Bearer <ca_jwt_token>"
      }
    }
  },

  // Public API examples for users browsing CA services
  publicApiExamples: {
    // Browse services for a specific CA
    browseCAServices: {
      method: "GET",
      url: "/api/ca/{caId}/services",
      // No authentication required
    },

    // Get specific service details
    getServiceDetails: {
      method: "GET", 
      url: "/api/ca/{caId}/services?serviceType=itr_filing",
      // No authentication required
    }
  }
};

console.log("📋 CA Service Management Usage Examples");
console.log("=====================================\n");

console.log("💰 Pricing Examples:");
console.log(`• ITR Filing: ₹${examples.itrFilingService.basePrice}`);
console.log(`• GST Filing: ₹${examples.gstFilingService.basePrice}`); 
console.log(`• Company Registration: ₹${examples.companyRegistrationService.basePrice}\n`);

console.log("🔧 How CAs can use the system:");
console.log("1. Initialize default services with templates");
console.log("2. Customize pricing for each service type");
console.log("3. Set additional charges for extra services");
console.log("4. Update multiple services at once");
console.log("5. Define requirements and features for each service\n");

console.log("🌐 Public features for users:");
console.log("1. Browse CA services and pricing");
console.log("2. Compare services across different CAs"); 
console.log("3. View service requirements before booking");
console.log("4. Understand what's included in each service\n");

module.exports = examples;