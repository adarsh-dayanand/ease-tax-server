const emailService = require("../services/emailService");
const logger = require("../config/logger");

class InquiryController {
  /**
   * Submit a general inquiry
   * POST /inquiry
   */
  async submitInquiry(req, res) {
    try {
      const {
        name,
        email,
        phone,
        caNumber,
        experience,
        specialization,
        message,
      } = req.body;

      // Basic validation
      if (!name || !email || !phone || !experience) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide all required fields (name, email, phone, experience)",
        });
      }

      // Send email to admin and CC the user
      await emailService.sendTemplateEmail(
        "shreepoornaadarshasrivatsa@gmail.com",
        "ca_inquiry",
        {
          name,
          email,
          phone,
          caNumber,
          experience,
          specialization,
          message,
        },
        email, // CC the user
      );

      res.json({
        success: true,
        message:
          "Your inquiry has been submitted successfully. We will get back to you soon.",
      });
    } catch (error) {
      logger.error("Error in submitInquiry:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit inquiry. Please try again later.",
      });
    }
  }
}

module.exports = new InquiryController();
