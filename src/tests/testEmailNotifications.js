/**
 * Test script for email notification system
 * Run with: node src/tests/testEmailNotifications.js
 */

require("dotenv").config();
const emailService = require("../services/emailService");
const notificationService = require("../services/notificationService");

async function testEmailService() {
  console.log("\n=== Testing Email Service ===\n");

  try {
    // Test 1: Verify configuration
    console.log("1. Verifying email configuration...");
    await emailService.verifyConfiguration();
    console.log("✓ Configuration verified\n");

    // Test 2: Send a basic test email
    console.log("2. Sending basic test email...");
    const testEmail = process.env.TEST_EMAIL || "your-email@example.com";

    const basicEmailResult = await emailService.sendEmail(
      testEmail,
      "EaseTax - Email Service Test",
      "<h1>Test Email</h1><p>This is a test email from EaseTax email service.</p>",
      "Test Email - This is a test email from EaseTax email service.",
    );

    console.log("✓ Basic email sent:", basicEmailResult.messageId, "\n");

    // Test 3: Send template email - Consultation Requested
    console.log("3. Sending consultation requested template email...");
    const consultationResult = await emailService.sendTemplateEmail(
      testEmail,
      "consultation_requested",
      {
        userName: "John Doe",
        userEmail: "john.doe@example.com",
        purpose: "ITR Filing for FY 2023-24",
        serviceRequestId: "test-123",
      },
    );
    console.log(
      "✓ Consultation template email sent:",
      consultationResult.messageId,
      "\n",
    );

    // Test 4: Send template email - Payment Successful
    console.log("4. Sending payment successful template email...");
    const paymentResult = await emailService.sendTemplateEmail(
      testEmail,
      "payment_successful",
      {
        amount: 2500,
        orderId: "ORD-2024-001",
        paymentId: "PAY-2024-001",
        serviceRequestId: "test-123",
        serviceName: "ITR Filing",
      },
    );
    console.log(
      "✓ Payment template email sent:",
      paymentResult.messageId,
      "\n",
    );

    // Test 5: Send template email - Meeting Scheduled
    console.log("5. Sending meeting scheduled template email...");
    const meetingResult = await emailService.sendTemplateEmail(
      testEmail,
      "meeting_scheduled",
      {
        scheduledDateTime: "February 10, 2024 at 3:00 PM IST",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        otherPartyName: "CA Rajesh Kumar",
        serviceRequestId: "test-123",
      },
    );
    console.log(
      "✓ Meeting template email sent:",
      meetingResult.messageId,
      "\n",
    );

    console.log("=== All Email Tests Passed! ===\n");
    console.log("Check your inbox at:", testEmail);
    console.log(
      "\nNote: Make sure to check your spam folder if you don't see the emails.\n",
    );
  } catch (error) {
    console.error("❌ Email test failed:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Check that RESEND_API_KEY is set in .env file");
    console.error("2. Verify that your domain is verified in Resend dashboard");
    console.error("3. Check that EMAIL_FROM matches your verified domain");
    console.error(
      "4. Set TEST_EMAIL environment variable to your email address\n",
    );
    process.exit(1);
  }
}

// Run tests
console.log("\n╔════════════════════════════════════════╗");
console.log("║  EaseTax Email Notification Tests     ║");
console.log("╚════════════════════════════════════════╝");

testEmailService()
  .then(() => {
    console.log("✓ Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("✗ Test failed:", error);
    process.exit(1);
  });
