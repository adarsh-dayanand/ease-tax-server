/**
 * Verification script for email data mapping
 * Checks if templates correctly handle fallback values and if new templates exist
 */

const emailTemplates = require("../utils/emailTemplates");

function verifyTemplates() {
  console.log("=== Verifying Email Data Mapping ===\n");

  const testCases = [
    {
      name: "Consultation Requested - Missing Data",
      template: "consultation_requested",
      data: { serviceRequestId: "123" },
      expectedSubject: "New Consultation Request from Client",
      checkInHtml: ["New consultation request from Client", "Client", "123"],
    },
    {
      name: "Consultation Accepted - Fallbacks",
      template: "consultation_accepted",
      data: { serviceRequestId: "456" },
      expectedSubject: "Consultation Accepted by Your CA",
      checkInHtml: ["Your CA", "456"],
    },
    {
      name: "New Template: Consultation Completed",
      template: "consultation_completed",
      data: {
        caName: "CA Smith",
        serviceRequestId: "789",
        completionNotes: "All good",
      },
      expectedSubject: "Service Completed by CA Smith",
      checkInHtml: ["CA Smith", "789", "All good"],
    },
    {
      name: "New Template: Document Verified",
      template: "document_verified",
      data: {
        documentName: "PAN Card",
        caName: "CA Rajesh",
        serviceRequestId: "101",
      },
      expectedSubject: "Document Verified: PAN Card",
      checkInHtml: ["PAN Card", "CA Rajesh"],
    },
    {
      name: "New Template: Document Rejected",
      template: "document_rejected",
      data: {
        documentName: "Form 16",
        caName: "CA Rajesh",
        rejectionReason: "Blurred",
        serviceRequestId: "102",
      },
      expectedSubject: "Document Rejected: Form 16",
      checkInHtml: ["Form 16", "Blurred"],
    },
    {
      name: "New Template: Meeting Rescheduled",
      template: "meeting_rescheduled",
      data: {
        newDateTime: "Feb 15, 10 AM",
        reason: "Power cut",
        serviceRequestId: "103",
      },
      expectedSubject: "Meeting Rescheduled - Feb 15, 10 AM",
      checkInHtml: ["Feb 15, 10 AM", "Power cut"],
    },
  ];

  let passed = 0;
  testCases.forEach((tc) => {
    const result = emailTemplates.getTemplate(tc.template, tc.data);
    if (!result) {
      console.error(`[FAIL] ${tc.name}: Template not found`);
      return;
    }

    if (result.subject !== tc.expectedSubject) {
      console.error(
        `[FAIL] ${tc.name}: Subject mismatch. Expected "${tc.expectedSubject}", got "${result.subject}"`,
      );
      return;
    }

    const missingHtml = tc.checkInHtml.filter(
      (item) => !result.html.includes(item),
    );
    if (missingHtml.length > 0) {
      console.error(
        `[FAIL] ${tc.name}: Missing strings in HTML: ${missingHtml.join(", ")}`,
      );
      return;
    }

    console.log(`[PASS] ${tc.name}`);
    passed++;
  });

  console.log(`\nResults: ${passed}/${testCases.length} passed.`);
  if (passed !== testCases.length) process.exit(1);
}

verifyTemplates();
