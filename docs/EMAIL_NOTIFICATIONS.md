# Email Notification System

## Overview

The EaseTax backend now supports sending email notifications to users and CAs using the Resend API. This system provides:

- **Multi-channel notifications**: Send both in-app and email notifications simultaneously
- **Professional email templates**: Responsive HTML templates for all notification types
- **Automatic retry logic**: Failed emails are automatically retried with exponential backoff
- **Delivery tracking**: Email delivery status is tracked in the database

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@easetax.co.in
EMAIL_FROM_NAME=EaseTax Team
```

### Domain Verification

Before sending emails, you must verify your domain in the Resend dashboard:

1. Log in to [Resend Dashboard](https://resend.com/domains)
2. Add your domain (`easetax.co.in`)
3. Add the required DNS records to your domain provider
4. Wait for verification (usually takes a few minutes)

## Usage

### Sending Notifications

The notification service automatically sends both in-app and email notifications for important events:

```javascript
const notificationService = require("./services/notificationService");

// Example: Notify CA of new consultation request
await notificationService.notifyConsultationRequested(caId, serviceRequestId, {
  name: "John Doe",
  email: "john@example.com",
  purpose: "ITR Filing for FY 2023-24",
});
```

### Available Notification Methods

All these methods send both in-app and email notifications:

- `notifyConsultationRequested(caId, serviceRequestId, userInfo)` - Notify CA of new request
- `notifyConsultationAccepted(userId, serviceRequestId, caInfo)` - Notify user of acceptance
- `notifyPaymentSuccessful(userId, paymentInfo)` - Notify user of successful payment
- `notifyDocumentUploaded(recipientId, recipientType, documentInfo)` - Notify of new document
- `notifyMeetingScheduled(recipientId, recipientType, meetingInfo)` - Notify of scheduled meeting

### Custom Multi-Channel Notifications

For custom notifications, use the `createMultiChannelNotification` method:

```javascript
await notificationService.createMultiChannelNotification(
  recipientId,
  recipientType,
  notificationType,
  title,
  message,
  {
    sendEmail: true, // Send email notification
    sendInApp: true, // Send in-app notification
    priority: "high",
    templateData: {
      // Data for email template
      userName: "John Doe",
      // ... other template data
    },
  },
);
```

## Email Templates

The following email templates are available:

1. **consultation_requested** - New consultation request (for CA)
2. **consultation_accepted** - Consultation accepted (for user)
3. **consultation_rejected** - Consultation rejected (for user)
4. **payment_successful** - Payment confirmation
5. **payment_failed** - Payment failure notice
6. **document_uploaded** - New document notification
7. **meeting_scheduled** - Meeting scheduled
8. **meeting_reminder** - Meeting reminder
9. **deadline_reminder** - Deadline reminder

All templates are responsive and include:

- Professional EaseTax branding
- Clear call-to-action buttons
- Relevant information in easy-to-read format
- Footer with company info and links

## Testing

### Run Email Tests

Test the email system with the provided test script:

```bash
# Set your test email address
export TEST_EMAIL=your-email@example.com

# Run the test script
node src/tests/testEmailNotifications.js
```

The test script will:

1. Verify email configuration
2. Send a basic test email
3. Send template emails for different notification types
4. Display results and message IDs

### Manual Testing

You can also test by triggering actual notifications in your application:

1. Create a consultation request
2. Accept/reject a consultation
3. Process a payment
4. Upload a document
5. Schedule a meeting

Check your email inbox (and spam folder) for the notifications.

## Troubleshooting

### Emails Not Being Received

1. **Check Resend Dashboard**: Log in to Resend and check the email logs
2. **Verify Domain**: Ensure your domain is verified in Resend
3. **Check Spam Folder**: Emails might be filtered as spam initially
4. **Check API Key**: Verify `RESEND_API_KEY` is correct in `.env`
5. **Check Sender Email**: Ensure `EMAIL_FROM` matches your verified domain

### Common Errors

**Error: "Resend client not initialized"**

- Solution: Check that `RESEND_API_KEY` is set in your `.env` file

**Error: "No email found for user/ca"**

- Solution: Ensure the user/CA has an email address in the database

**Error: "Domain not verified"**

- Solution: Verify your domain in the Resend dashboard

### Viewing Logs

Email sending is logged using Winston. Check the logs for details:

```bash
# View logs
tail -f logs/combined.log

# Search for email-related logs
grep -i "email" logs/combined.log
```

## Architecture

### Files

- **`src/services/emailService.js`** - Core email service using Resend SDK
- **`src/utils/emailTemplates.js`** - HTML email templates
- **`src/services/notificationService.js`** - Notification service with email integration
- **`src/tests/testEmailNotifications.js`** - Test script

### Database

Email notifications are tracked in the `notifications` table with:

- `channel: 'email'` - Identifies email notifications
- `status: 'sent'|'failed'` - Delivery status
- `externalId` - Resend message ID for tracking
- `sentAt` / `failedAt` - Timestamps
- `failureReason` - Error message if failed

## Best Practices

1. **Always provide template data**: Ensure all required fields are included
2. **Handle errors gracefully**: Email failures shouldn't break your application flow
3. **Monitor delivery**: Regularly check Resend dashboard for delivery issues
4. **Test before production**: Use the test script to verify everything works
5. **Keep templates updated**: Update email templates when UI/UX changes

## Future Enhancements

Potential improvements:

- Email preferences for users (opt-in/opt-out)
- Scheduled email notifications
- Email analytics and tracking
- A/B testing for email templates
- Unsubscribe functionality
- Email digest (daily/weekly summaries)
