const paymentService = require("../services/paymentService");
const logger = require("../config/logger");

class PaymentController {
  /**
   * Initiate payment for booking
   * POST /payments/initiate
   */
  async initiatePayment(req, res) {
    try {
      const userId = req.user.id;
      const { serviceRequestId, paymentType } = req.body;

      if (!serviceRequestId || !paymentType) {
        return res.status(400).json({
          success: false,
          message: "Service request ID and payment type are required",
        });
      }

      let paymentData;

      if (paymentType === "booking") {
        paymentData = await paymentService.initiateBookingPayment(
          userId,
          serviceRequestId
        );
      } else if (paymentType === "final") {
        paymentData = await paymentService.initiateFinalPayment(
          userId,
          serviceRequestId
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment type. Must be "booking" or "final"',
        });
      }

      res.status(201).json({
        success: true,
        data: paymentData,
        message: "Payment initiated successfully",
      });
    } catch (error) {
      logger.error("Error in initiatePayment:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to initiate payment",
      });
    }
  }

  /**
   * Get payment status
   * GET /payments/:paymentId/status
   */
  async getPaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;
      const userId = req.user.id;

      const paymentStatus = await paymentService.getPaymentStatus(paymentId);

      // Check if user has access to this payment
      if (paymentStatus.userId !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.json({
        success: true,
        data: paymentStatus,
      });
    } catch (error) {
      logger.error("Error in getPaymentStatus:", error);

      if (error.message === "Payment not found") {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get payment history
   * GET /payments/history
   */
  async getPaymentHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const paymentHistory = await paymentService.getPaymentHistory(
        userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: paymentHistory.data,
        pagination: paymentHistory.pagination,
      });
    } catch (error) {
      logger.error("Error in getPaymentHistory:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Request refund
   * POST /payments/refund
   */
  async requestRefund(req, res) {
    try {
      const userId = req.user.id;
      const { paymentId, reason } = req.body;

      if (!paymentId || !reason) {
        return res.status(400).json({
          success: false,
          message: "Payment ID and reason are required",
        });
      }

      const refundResult = await paymentService.processRefund(
        paymentId,
        userId,
        reason
      );

      res.json({
        success: true,
        data: refundResult,
        message: "Refund processed successfully",
      });
    } catch (error) {
      logger.error("Error in requestRefund:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to process refund",
      });
    }
  }

  /**
   * Payment webhook handler
   * POST /payments/webhook
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers["x-razorpay-signature"];
      const payload = JSON.stringify(req.body);

      // Verify webhook signature
      const isValid = await paymentService.verifyWebhook(signature, payload);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook signature",
        });
      }

      // Process webhook
      await paymentService.handlePaymentWebhook(req.body);

      res.json({
        success: true,
        message: "Webhook processed successfully",
      });
    } catch (error) {
      logger.error("Error in handleWebhook:", error);
      res.status(500).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  }

  /**
   * Mock payment success (development only)
   * POST /payments/:paymentId/mock-success
   */
  async mockPaymentSuccess(req, res) {
    try {
      if (process.env.NODE_ENV !== "development") {
        return res.status(403).json({
          success: false,
          message: "Mock payments only available in development",
        });
      }

      const { paymentId } = req.params;
      const { Payment, ServiceRequest } = require("../../models");

      const payment = await Payment.findByPk(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      // Update payment status
      await payment.update({
        status: "completed",
        transactionId: `mock_txn_${Date.now()}`,
        paymentMethod: "mock",
      });

      // Update service request payment status
      const paymentStatus = payment.type === "booking" ? "token-paid" : "paid";
      await ServiceRequest.update(
        { paymentStatus },
        { where: { id: payment.serviceRequestId } }
      );

      res.json({
        success: true,
        message: "Mock payment success processed",
        data: {
          paymentId: payment.id,
          status: "completed",
          transactionId: payment.transactionId,
        },
      });
    } catch (error) {
      logger.error("Error in mockPaymentSuccess:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get payment methods
   * GET /payments/methods
   */
  async getPaymentMethods(req, res) {
    try {
      const paymentMethods = [
        {
          id: "card",
          name: "Credit/Debit Card",
          description: "Visa, Mastercard, Rupay",
          icon: "credit-card",
          enabled: true,
        },
        {
          id: "netbanking",
          name: "Net Banking",
          description: "All major banks supported",
          icon: "bank",
          enabled: true,
        },
        {
          id: "upi",
          name: "UPI",
          description: "PhonePe, GooglePay, Paytm",
          icon: "mobile-payment",
          enabled: true,
        },
        {
          id: "wallet",
          name: "Wallet",
          description: "Paytm, Mobikwik, FreeCharge",
          icon: "wallet",
          enabled: true,
        },
      ];

      res.json({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      logger.error("Error in getPaymentMethods:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get payment analytics (admin only)
   * GET /payments/analytics
   */
  async getPaymentAnalytics(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const { Payment } = require("../../models");
      const { Op } = require("sequelize");

      // Get analytics data
      const [
        totalRevenue,
        totalTransactions,
        completedPayments,
        failedPayments,
        refundAmount,
        bookingPayments,
        finalPayments,
      ] = await Promise.all([
        Payment.sum("amount", {
          where: { status: "completed", amount: { [Op.gt]: 0 } },
        }),
        Payment.count(),
        Payment.count({ where: { status: "completed" } }),
        Payment.count({ where: { status: "failed" } }),
        Payment.sum("amount", {
          where: { type: "refund", status: "completed" },
        }),
        Payment.count({ where: { type: "booking", status: "completed" } }),
        Payment.count({ where: { type: "final", status: "completed" } }),
      ]);

      const analytics = {
        totalRevenue: totalRevenue || 0,
        totalTransactions,
        completedPayments,
        failedPayments,
        refundAmount: Math.abs(refundAmount || 0),
        successRate:
          totalTransactions > 0
            ? ((completedPayments / totalTransactions) * 100).toFixed(2)
            : 0,
        bookingPayments,
        finalPayments,
        averageTransactionValue:
          completedPayments > 0
            ? ((totalRevenue || 0) / completedPayments).toFixed(2)
            : 0,
      };

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error("Error in getPaymentAnalytics:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new PaymentController();
