"use strict";

/**
 * Migration to update Services category enum to match the screenshot requirements
 * Current enum: 'tax_filing', 'tax_planning', 'gst', 'audit', 'consultation', 'compliance', 'business_setup'
 * New enum should be: 'tax_filing', 'gst_registration', 'gst_return_filing', 'company_registration', 
 * 'trademark_registration', 'tax_consultation', 'audit_services', 'compliance_check', 
 * 'financial_consultation', 'other'
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, add new enum values that don't exist
    // PostgreSQL allows adding values to existing enums
    
    // Add new enum values one by one (if they don't exist)
    const newValues = [
      "gst_registration",
      "gst_return_filing",
      "company_registration",
      "trademark_registration",
      "tax_consultation",
      "audit_services",
      "compliance_check",
      "financial_consultation",
      "other"
    ];

    for (const value of newValues) {
      try {
        await queryInterface.sequelize.query(
          `DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_enum 
              WHERE enumlabel = '${value}' 
              AND enumtypid = (
                SELECT oid FROM pg_type WHERE typname = 'enum_Services_category'
              )
            ) THEN
              ALTER TYPE "enum_Services_category" ADD VALUE '${value}';
            END IF;
          END $$;`
        );
      } catch (error) {
        // Value might already exist or enum might not exist yet
        console.log(`Skipping ${value}: ${error.message}`);
      }
    }

    // Update existing data to map old values to new values
    // Map old enum values to new ones
    const valueMappings = {
      'tax_planning': 'tax_consultation', // Map tax_planning to tax_consultation
      'gst': 'gst_registration', // Map gst to gst_registration
      'audit': 'audit_services', // Map audit to audit_services
      'consultation': 'tax_consultation', // Map consultation to tax_consultation
      'compliance': 'compliance_check', // Map compliance to compliance_check
      'business_setup': 'company_registration', // Map business_setup to company_registration
    };

    for (const [oldValue, newValue] of Object.entries(valueMappings)) {
      try {
        await queryInterface.sequelize.query(
          `UPDATE "Services" 
           SET category = '${newValue}'::"enum_Services_category"
           WHERE category = '${oldValue}'::"enum_Services_category";`
        );
      } catch (error) {
        console.log(`Error updating ${oldValue} to ${newValue}: ${error.message}`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Revert data mappings
    const valueMappings = {
      'tax_consultation': 'consultation',
      'gst_registration': 'gst',
      'audit_services': 'audit',
      'compliance_check': 'compliance',
      'company_registration': 'business_setup',
    };

    for (const [newValue, oldValue] of Object.entries(valueMappings)) {
      try {
        await queryInterface.sequelize.query(
          `UPDATE "Services" 
           SET category = '${oldValue}'::"enum_Services_category"
           WHERE category = '${newValue}'::"enum_Services_category";`
        );
      } catch (error) {
        console.log(`Error reverting ${newValue} to ${oldValue}: ${error.message}`);
      }
    }

    // Note: PostgreSQL doesn't allow removing enum values easily
    // This would require recreating the enum, which is complex
    // So we'll leave the new enum values in place
  },
};

