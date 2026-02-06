const { Resend } = require("resend");
const logger = require("../config/logger");

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.EMAIL_FROM || "noreply@easetax.co.in";
    this.fromName = process.env.EMAIL_FROM_NAME || "EaseTax Team";
  }

  /**
   * Send a basic email
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   * @param {string} text - Plain text content (optional)
   * @returns {Promise<Object>} - Resend response with message ID
   */
  async sendEmail(to, subject, html, text = null) {
    try {
      if (!this.resend) {
        throw new Error(
          "Resend client not initialized. Check RESEND_API_KEY in environment variables.",
        );
      }

      const emailData = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject,
        html,
      };

      if (text) {
        emailData.text = text;
      }

      logger.info(`Sending email to ${to}: ${subject}`);

      const response = await this.resend.emails.send(emailData);

      logger.info(
        `Email sent successfully to ${to}. Message ID: ${response.data?.id}`,
      );

      return {
        success: true,
        messageId: response.data?.id,
        response: response.data,
      };
    } catch (error) {
      logger.error(`Error sending email to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send email using a template
   * @param {string} to - Recipient email address
   * @param {string} templateName - Template name
   * @param {Object} templateData - Data to populate template
   * @returns {Promise<Object>} - Resend response
   */
  async sendTemplateEmail(to, templateName, templateData) {
    try {
      const emailTemplates = require("../utils/emailTemplates");

      const template = emailTemplates.getTemplate(templateName, templateData);

      if (!template) {
        throw new Error(`Email template '${templateName}' not found`);
      }

      return await this.sendEmail(
        to,
        template.subject,
        template.html,
        template.text,
      );
    } catch (error) {
      logger.error(
        `Error sending template email '${templateName}' to ${to}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send bulk emails (same content to multiple recipients)
   * @param {Array<string>} recipients - Array of recipient email addresses
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   * @param {string} text - Plain text content (optional)
   * @returns {Promise<Array>} - Array of results
   */
  async sendBulkEmails(recipients, subject, html, text = null) {
    try {
      const results = [];

      for (const recipient of recipients) {
        try {
          const result = await this.sendEmail(recipient, subject, html, text);
          results.push({
            email: recipient,
            success: true,
            messageId: result.messageId,
          });
        } catch (error) {
          results.push({
            email: recipient,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      logger.info(
        `Bulk email sent: ${successCount}/${recipients.length} successful`,
      );

      return results;
    } catch (error) {
      logger.error("Error sending bulk emails:", error);
      throw error;
    }
  }

  /**
   * Send email with retry logic
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   * @param {string} text - Plain text content (optional)
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} - Resend response
   */
  async sendEmailWithRetry(to, subject, html, text = null, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendEmail(to, subject, html, text);
      } catch (error) {
        lastError = error;
        logger.warn(
          `Email send attempt ${attempt}/${maxRetries} failed for ${to}:`,
          error.message,
        );

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }

  /**
   * Verify email configuration
   * @returns {Promise<boolean>} - True if configuration is valid
   */
  async verifyConfiguration() {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY not found in environment variables");
      }

      if (!this.resend) {
        throw new Error("Resend client not initialized");
      }

      logger.info("Email service configuration verified successfully");
      return true;
    } catch (error) {
      logger.error("Email service configuration verification failed:", error);
      throw error;
    }
  }
}

module.exports = new EmailService();
