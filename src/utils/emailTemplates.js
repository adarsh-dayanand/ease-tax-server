/**
 * Email Templates for EaseTax Notifications
 * Provides HTML email templates for various notification types
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Base HTML template wrapper
 */
const baseTemplate = (content, preheader = "") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>EaseTax Notification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333333;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: #333333;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .button:hover {
      opacity: 0.9;
    }
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px 20px;
      text-align: center;
      font-size: 14px;
      color: #666666;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: #e0e0e0;
      margin: 30px 0;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
      .button {
        display: block;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <div class="email-container">
    <div class="header">
      <h1>EaseTax</h1>
    </div>
    ${content}
    <div class="footer">
      <p>© ${new Date().getFullYear()} EaseTax. All rights reserved.</p>
      <p>
        <a href="${FRONTEND_URL}">Visit Website</a> | 
        <a href="${FRONTEND_URL}/support">Support</a> | 
        <a href="${FRONTEND_URL}/privacy">Privacy Policy</a>
      </p>
      <p style="font-size: 12px; color: #999999; margin-top: 20px;">
        You're receiving this email because you have an account with EaseTax.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Create action button HTML
 */
const createButton = (text, url) => `
  <a href="${url}" class="button">${text}</a>
`;

/**
 * Template: Consultation Requested (for CA)
 */
const consultationRequestedTemplate = (data) => {
  const { userName, userEmail, purpose, serviceRequestId } = data;
  const actionUrl = `${FRONTEND_URL}/ca/consultations/${serviceRequestId}`;

  const content = `
    <div class="content">
      <p class="greeting">Hello,</p>
      <p class="message">
        You have received a new consultation request from <strong>${userName}</strong>.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Client:</strong> ${userName}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
        ${purpose ? `<p style="margin: 5px 0;"><strong>Purpose:</strong> ${purpose}</p>` : ""}
      </div>
      <p class="message">
        Please review the request and respond at your earliest convenience.
      </p>
      ${createButton("View Request", actionUrl)}
      <p style="font-size: 14px; color: #666666; margin-top: 30px;">
        If you have any questions, please contact our support team.
      </p>
    </div>
  `;

  return {
    subject: `New Consultation Request from ${userName}`,
    html: baseTemplate(content, `New consultation request from ${userName}`),
    text: `You have received a new consultation request from ${userName} (${userEmail}). Purpose: ${purpose || "Not specified"}. View request: ${actionUrl}`,
  };
};

/**
 * Template: Consultation Accepted (for User)
 */
const consultationAcceptedTemplate = (data) => {
  const { caName, caEmail, serviceRequestId } = data;
  const actionUrl = `${FRONTEND_URL}/consultations/${serviceRequestId}`;

  const content = `
    <div class="content">
      <p class="greeting">Great news!</p>
      <p class="message">
        <strong>${caName}</strong> has accepted your consultation request.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>CA Name:</strong> ${caName}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${caEmail}</p>
      </div>
      <p class="message">
        You can now proceed with scheduling a meeting and sharing your documents.
      </p>
      ${createButton("View Details", actionUrl)}
    </div>
  `;

  return {
    subject: `Consultation Accepted by ${caName}`,
    html: baseTemplate(
      content,
      `${caName} has accepted your consultation request`,
    ),
    text: `${caName} has accepted your consultation request. View details: ${actionUrl}`,
  };
};

/**
 * Template: Consultation Rejected (for User)
 */
const consultationRejectedTemplate = (data) => {
  const { caName, reason, serviceRequestId } = data;
  const actionUrl = `${FRONTEND_URL}/consultations/${serviceRequestId}`;

  const content = `
    <div class="content">
      <p class="greeting">Hello,</p>
      <p class="message">
        Unfortunately, <strong>${caName}</strong> is unable to accept your consultation request at this time.
      </p>
      ${
        reason
          ? `
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>
      </div>
      `
          : ""
      }
      <p class="message">
        Don't worry! You can browse other qualified Chartered Accountants on our platform.
      </p>
      ${createButton("Find Another CA", `${FRONTEND_URL}/find-ca`)}
    </div>
  `;

  return {
    subject: "Consultation Request Update",
    html: baseTemplate(content, "Update on your consultation request"),
    text: `${caName} is unable to accept your consultation request. ${reason ? `Reason: ${reason}` : ""} Find another CA: ${FRONTEND_URL}/find-ca`,
  };
};

/**
 * Template: Payment Successful (for User)
 */
const paymentSuccessfulTemplate = (data) => {
  const { amount, orderId, paymentId, serviceRequestId, serviceName } = data;
  const actionUrl = `${FRONTEND_URL}/payments/${paymentId}`;

  const content = `
    <div class="content">
      <p class="greeting">Payment Successful!</p>
      <p class="message">
        Your payment has been processed successfully. Thank you for choosing EaseTax.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ₹${amount}</p>
        <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
        <p style="margin: 5px 0;"><strong>Payment ID:</strong> ${paymentId}</p>
        ${serviceName ? `<p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>` : ""}
      </div>
      <p class="message">
        Your CA will be notified and will begin working on your request shortly.
      </p>
      ${createButton("View Receipt", actionUrl)}
    </div>
  `;

  return {
    subject: `Payment Successful - ₹${amount}`,
    html: baseTemplate(content, `Payment of ₹${amount} processed successfully`),
    text: `Your payment of ₹${amount} has been processed successfully. Order ID: ${orderId}. View receipt: ${actionUrl}`,
  };
};

/**
 * Template: Payment Failed (for User)
 */
const paymentFailedTemplate = (data) => {
  const { amount, orderId, reason, serviceRequestId } = data;
  const actionUrl = `${FRONTEND_URL}/consultations/${serviceRequestId}`;

  const content = `
    <div class="content">
      <p class="greeting">Payment Failed</p>
      <p class="message">
        We were unable to process your payment. Please try again.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${amount}</p>
        <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
        ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ""}
      </div>
      <p class="message">
        If you continue to experience issues, please contact our support team.
      </p>
      ${createButton("Retry Payment", actionUrl)}
    </div>
  `;

  return {
    subject: "Payment Failed - Action Required",
    html: baseTemplate(content, "Your payment could not be processed"),
    text: `Payment of ₹${amount} failed. ${reason ? `Reason: ${reason}` : ""} Retry: ${actionUrl}`,
  };
};

/**
 * Template: Document Uploaded
 */
const documentUploadedTemplate = (data) => {
  const { documentName, uploaderName, uploaderType, serviceRequestId } = data;
  const actionUrl = `${FRONTEND_URL}/consultations/${serviceRequestId}`;

  const content = `
    <div class="content">
      <p class="greeting">New Document Uploaded</p>
      <p class="message">
        ${uploaderName} has uploaded a new document.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Document:</strong> ${documentName}</p>
        <p style="margin: 5px 0;"><strong>Uploaded by:</strong> ${uploaderName} (${uploaderType === "ca" ? "CA" : "User"})</p>
      </div>
      ${createButton("View Document", actionUrl)}
    </div>
  `;

  return {
    subject: `New Document: ${documentName}`,
    html: baseTemplate(content, `${uploaderName} uploaded ${documentName}`),
    text: `${uploaderName} has uploaded a new document: ${documentName}. View: ${actionUrl}`,
  };
};

/**
 * Template: Meeting Scheduled
 */
const meetingScheduledTemplate = (data) => {
  const { scheduledDateTime, meetingUrl, otherPartyName, serviceRequestId } =
    data;
  const actionUrl =
    meetingUrl || `${FRONTEND_URL}/consultations/${serviceRequestId}`;

  const content = `
    <div class="content">
      <p class="greeting">Meeting Scheduled</p>
      <p class="message">
        A consultation meeting has been scheduled with <strong>${otherPartyName}</strong>.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${scheduledDateTime}</p>
        <p style="margin: 5px 0;"><strong>With:</strong> ${otherPartyName}</p>
      </div>
      <p class="message">
        Please make sure to join the meeting on time. A reminder will be sent before the meeting.
      </p>
      ${createButton("Join Meeting", actionUrl)}
    </div>
  `;

  return {
    subject: `Meeting Scheduled - ${scheduledDateTime}`,
    html: baseTemplate(
      content,
      `Meeting scheduled with ${otherPartyName} on ${scheduledDateTime}`,
    ),
    text: `Meeting scheduled with ${otherPartyName} on ${scheduledDateTime}. Join: ${actionUrl}`,
  };
};

/**
 * Template: Meeting Reminder
 */
const meetingReminderTemplate = (data) => {
  const { scheduledDateTime, meetingUrl, otherPartyName, minutesUntilMeeting } =
    data;

  const content = `
    <div class="content">
      <p class="greeting">Meeting Reminder</p>
      <p class="message">
        Your meeting with <strong>${otherPartyName}</strong> is starting in ${minutesUntilMeeting} minutes.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Time:</strong> ${scheduledDateTime}</p>
        <p style="margin: 5px 0;"><strong>With:</strong> ${otherPartyName}</p>
      </div>
      ${createButton("Join Now", meetingUrl)}
    </div>
  `;

  return {
    subject: `Meeting Reminder - Starting in ${minutesUntilMeeting} minutes`,
    html: baseTemplate(content, `Meeting with ${otherPartyName} starting soon`),
    text: `Reminder: Meeting with ${otherPartyName} starting in ${minutesUntilMeeting} minutes. Join: ${meetingUrl}`,
  };
};

/**
 * Template: Deadline Reminder
 */
const deadlineReminderTemplate = (data) => {
  const { taskName, deadline, serviceRequestId } = data;
  const actionUrl = `${FRONTEND_URL}/consultations/${serviceRequestId}`;

  const content = `
    <div class="content">
      <p class="greeting">Deadline Reminder</p>
      <p class="message">
        This is a reminder about an upcoming deadline.
      </p>
      <div class="info-box">
        <p style="margin: 5px 0;"><strong>Task:</strong> ${taskName}</p>
        <p style="margin: 5px 0;"><strong>Deadline:</strong> ${deadline}</p>
      </div>
      <p class="message">
        Please ensure all required actions are completed before the deadline.
      </p>
      ${createButton("View Details", actionUrl)}
    </div>
  `;

  return {
    subject: `Deadline Reminder: ${taskName}`,
    html: baseTemplate(content, `Deadline approaching for ${taskName}`),
    text: `Deadline reminder: ${taskName} is due on ${deadline}. View: ${actionUrl}`,
  };
};

/**
 * Get template by name
 */
const getTemplate = (templateName, data) => {
  const templates = {
    consultation_requested: consultationRequestedTemplate,
    consultation_accepted: consultationAcceptedTemplate,
    consultation_rejected: consultationRejectedTemplate,
    payment_successful: paymentSuccessfulTemplate,
    payment_failed: paymentFailedTemplate,
    document_uploaded: documentUploadedTemplate,
    meeting_scheduled: meetingScheduledTemplate,
    meeting_reminder: meetingReminderTemplate,
    deadline_reminder: deadlineReminderTemplate,
  };

  const templateFunction = templates[templateName];

  if (!templateFunction) {
    return null;
  }

  return templateFunction(data);
};

module.exports = {
  getTemplate,
  baseTemplate,
  createButton,
};
