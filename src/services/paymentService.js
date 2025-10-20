const { Payment, ServiceRequest, User, CA } = require("../../models");
const { Op } = require("sequelize");
const cacheService = require("./cacheService");
const couponService = require("./couponService");
const logger = require("../config/logger");
const crypto = require("crypto");

class PaymentService {
  constructor() {
    this.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    this.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Commission rates
    this.platformCommission = 0.08; // 8%
    this.bookingFee = 999; // ₹999

    // Mock payment gateway for development
    this.mockMode =
      process.env.NODE_ENV === "development" && !this.razorpayKeyId;
  }

  /**
   * Initiate payment for consultation booking - ONLY after CA acceptance
   */
  async initiateBookingPayment(userId, serviceRequestId, couponCode = null) {
    try {
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "phone"],
          },
          {
            model: CA,
            as: "ca",
            attributes: ["id", "name", "commissionPercentage"],
          },
        ],
      });

      if (!serviceRequest) {
        throw new Error("Service request not found");
      }

      if (serviceRequest.userId !== userId) {
        throw new Error("Access denied");
      }

      // Check if CA has accepted the request
      if (serviceRequest.status !== "accepted") {
        throw new Error("Payment can only be initiated after CA acceptance");
      }

      if (!serviceRequest.caId) {
        throw new Error("No CA assigned to this request");
      }

      // Check if booking payment already exists
      const existingPayment = await Payment.findOne({
        where: {
          serviceRequestId,
          paymentType: "booking_fee",
          status: { [Op.in]: ["pending", "completed"] },
        },
      });

      if (existingPayment) {
        return await this.getPaymentStatus(existingPayment.id);
      }

      let amount = this.bookingFee;
      let discountAmount = 0;
      let couponId = null;
      let originalAmount = amount;

      // Apply coupon if provided
      if (couponCode) {
        const couponResult = await couponService.validateAndApplyCoupon(
          couponCode,
          userId,
          amount,
          serviceRequest.serviceType
        );

        if (couponResult.valid) {
          originalAmount = amount;
          discountAmount = couponResult.discountAmount;
          amount = couponResult.finalAmount;
          couponId = couponResult.couponId;
        }
      }

      // Get CA's commission percentage (use CA-specific or default)
      const commissionPercentage =
        serviceRequest.ca?.commissionPercentage ||
        this.platformCommission * 100;

      // Create payment record
      const payment = await Payment.create({
        payerId: userId,
        payeeId: serviceRequest.caId,
        serviceRequestId,
        amount,
        originalAmount,
        discountAmount,
        couponId,
        currency: "INR",
        paymentType: "booking_fee",
        status: "pending",
        paymentGateway: this.mockMode ? null : "razorpay",
        commissionPercentage,
        metadata: {
          serviceRequestId,
          description: `Booking fee for consultation with ${serviceRequest.ca?.name}`,
          couponApplied: !!couponCode,
        },
      });

      let paymentGatewayResponse;

      if (this.mockMode) {
        // Mock payment for development
        paymentGatewayResponse = await this.createMockPayment(payment);
      } else {
        // Real Razorpay integration
        paymentGatewayResponse = await this.createRazorpayOrder(payment);
      }

      // Update payment with gateway details
      await payment.update({
        gatewayOrderId: paymentGatewayResponse.id,
        webhookData: paymentGatewayResponse,
      });

      return {
        paymentId: payment.id,
        orderId: paymentGatewayResponse.id,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        discountAmount: payment.discountAmount,
        currency: payment.currency,
        keyId: this.razorpayKeyId,
        prefill: {
          name: serviceRequest.user?.name,
          email: serviceRequest.user?.email,
          contact: serviceRequest.user?.phone,
        },
        notes: {
          serviceRequestId: serviceRequestId,
          paymentType: "booking_fee",
        },
      };
    } catch (error) {
      logger.error("Error initiating booking payment:", error);
      throw error;
    }
  }

  /**
   * Initiate final payment after service completion
   */
  async initiateFinalPayment(userId, serviceRequestId, couponCode = null) {
    try {
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "phone"],
          },
          {
            model: CA,
            as: "ca",
            attributes: ["id", "name", "commissionPercentage"],
          },
        ],
      });

      if (!serviceRequest) {
        throw new Error("Service request not found");
      }

      if (serviceRequest.userId !== userId) {
        throw new Error("Access denied");
      }

      // Check if service is completed
      if (!["completed"].includes(serviceRequest.status)) {
        throw new Error("Service not yet completed");
      }

      // Check if final payment already exists
      const existingPayment = await Payment.findOne({
        where: {
          serviceRequestId,
          paymentType: "service_fee",
          status: { [Op.in]: ["pending", "completed"] },
        },
      });

      if (existingPayment) {
        return await this.getPaymentStatus(existingPayment.id);
      }

      // Calculate final amount (total - booking fee already paid)
      const totalAmount =
        serviceRequest.finalAmount || serviceRequest.estimatedAmount || 2500;
      let finalAmount = totalAmount - this.bookingFee;

      if (finalAmount <= 0) {
        throw new Error("No additional payment required");
      }

      let discountAmount = 0;
      let couponId = null;
      let originalAmount = finalAmount;

      // Apply coupon if provided
      if (couponCode) {
        const couponResult = await couponService.validateAndApplyCoupon(
          couponCode,
          userId,
          finalAmount,
          serviceRequest.serviceType
        );

        if (couponResult.valid) {
          originalAmount = finalAmount;
          discountAmount = couponResult.discountAmount;
          finalAmount = couponResult.finalAmount;
          couponId = couponResult.couponId;
        }
      }

      // Get CA's commission percentage
      const commissionPercentage =
        serviceRequest.ca?.commissionPercentage ||
        this.platformCommission * 100;

      // Create payment record
      const payment = await Payment.create({
        payerId: userId,
        payeeId: serviceRequest.caId,
        serviceRequestId,
        amount: finalAmount,
        originalAmount,
        discountAmount,
        couponId,
        currency: "INR",
        paymentType: "service_fee",
        status: "pending",
        paymentGateway: this.mockMode ? null : "razorpay",
        isEscrow: true, // Service fees go to escrow until completion
        commissionPercentage,
        metadata: {
          serviceRequestId,
          description: `Service fee for consultation with ${serviceRequest.ca?.name}`,
          totalAmount,
          bookingFee: this.bookingFee,
          couponApplied: !!couponCode,
        },
      });

      // Calculate commission
      payment.calculateCommission();
      await payment.save();

      let paymentGatewayResponse;

      if (this.mockMode) {
        paymentGatewayResponse = await this.createMockPayment(payment);
      } else {
        paymentGatewayResponse = await this.createRazorpayOrder(payment);
      }

      await payment.update({
        gatewayOrderId: paymentGatewayResponse.id,
        webhookData: paymentGatewayResponse,
      });

      return {
        paymentId: payment.id,
        orderId: paymentGatewayResponse.id,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        discountAmount: payment.discountAmount,
        commissionAmount: payment.commissionAmount,
        netAmount: payment.netAmount,
        currency: payment.currency,
        keyId: this.razorpayKeyId,
        prefill: {
          name: serviceRequest.user?.name,
          email: serviceRequest.user?.email,
          contact: serviceRequest.user?.phone,
        },
        notes: {
          serviceRequestId: serviceRequestId,
          paymentType: "service_fee",
        },
      };
    } catch (error) {
      logger.error("Error initiating final payment:", error);
      throw error;
    }
  }

  /**
   * Get payment status with caching
   */
  async getPaymentStatus(paymentId) {
    try {
      const cacheKey = cacheService.getCacheKeys().PAYMENT_STATUS(paymentId);

      let paymentStatus = await cacheService.get(cacheKey);

      if (!paymentStatus) {
        const payment = await Payment.findByPk(paymentId, {
          include: [
            {
              model: ServiceRequest,
              as: "serviceRequest",
              include: [
                {
                  model: CA,
                  as: "ca",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        });

        if (!payment) {
          throw new Error("Payment not found");
        }

        paymentStatus = {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentType: payment.paymentType,
          gatewayOrderId: payment.gatewayOrderId,
          gatewayPaymentId: payment.gatewayPaymentId,
          transactionReference: payment.transactionReference,
          paymentMethod: payment.paymentMethod,
          serviceRequestId: payment.serviceRequestId,
          caName: payment.serviceRequest?.ca?.name,
          paymentDate: payment.paymentDate,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          failureReason: payment.failureReason,
          isEscrow: payment.isEscrow,
          escrowReleaseDate: payment.escrowReleaseDate,
        };

        // Cache completed payments for longer, pending ones for shorter duration
        const cacheTime = payment.status === "completed" ? 3600 : 300;
        await cacheService.set(cacheKey, paymentStatus, cacheTime);
      }

      return paymentStatus;
    } catch (error) {
      logger.error("Error getting payment status:", error);
      throw error;
    }
  }

  /**
   * Get payment history for user
   */
  async getPaymentHistory(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;

      const { rows, count } = await Payment.findAndCountAll({
        where: { payerId: userId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: ServiceRequest,
            as: "serviceRequest",
            include: [
              {
                model: CA,
                as: "ca",
                attributes: ["id", "name"],
              },
            ],
          },
        ],
      });

      const payments = rows.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentType: payment.paymentType,
        gatewayPaymentId: payment.gatewayPaymentId,
        transactionReference: payment.transactionReference,
        paymentMethod: payment.paymentMethod,
        serviceRequestId: payment.serviceRequestId,
        caName: payment.serviceRequest?.ca?.name,
        paymentDate: payment.paymentDate,
        createdAt: payment.createdAt,
      }));

      return {
        data: payments,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting payment history:", error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async processRefund(paymentId, userId, reason) {
    try {
      const payment = await Payment.findByPk(paymentId, {
        include: [
          {
            model: ServiceRequest,
            as: "serviceRequest",
          },
        ],
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.payerId !== userId && req.user?.role !== "admin") {
        throw new Error("Access denied");
      }

      if (payment.status !== "completed") {
        throw new Error("Only completed payments can be refunded");
      }

      // Check refund eligibility based on service request status
      const refundAmount = this.calculateRefundAmount(payment);

      if (refundAmount <= 0) {
        throw new Error("No refund available for this payment");
      }

      // Create refund record
      const refund = await Payment.create({
        payerId: payment.payerId,
        payeeId: null, // Platform handles refunds
        serviceRequestId: payment.serviceRequestId,
        amount: refundAmount,
        currency: payment.currency,
        paymentType: "refund",
        status: "pending",
        paymentGateway: payment.paymentGateway,
        metadata: {
          originalPaymentId: paymentId,
          refundReason: reason,
          refundAmount,
        },
      });

      let refundResponse;

      if (this.mockMode) {
        refundResponse = await this.createMockRefund(refund);
      } else {
        refundResponse = await this.createRazorpayRefund(payment, refundAmount);
      }

      await refund.update({
        gatewayPaymentId: refundResponse.id,
        webhookData: refundResponse,
        status: "completed",
        paymentDate: new Date(),
        refundDate: new Date(),
        refundReason: reason,
      });

      // Clear cache
      await this.clearPaymentCache(paymentId);

      return {
        refundId: refund.id,
        amount: refundAmount,
        currency: payment.currency,
        status: refund.status,
        message: "Refund processed successfully",
      };
    } catch (error) {
      logger.error("Error processing refund:", error);
      throw error;
    }
  }

  /**
   * Verify payment webhook
   */
  async verifyWebhook(signature, payload) {
    try {
      if (this.mockMode) {
        return true; // Skip verification in mock mode
      }

      const expectedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(payload)
        .digest("hex");

      return signature === expectedSignature;
    } catch (error) {
      logger.error("Error verifying webhook:", error);
      return false;
    }
  }

  /**
   * Handle payment webhook
   */
  async handlePaymentWebhook(payload) {
    try {
      const { event, payload: data } = payload;

      if (event === "payment.captured") {
        await this.handlePaymentSuccess(data.payment.entity);
      } else if (event === "payment.failed") {
        await this.handlePaymentFailure(data.payment.entity);
      }

      return true;
    } catch (error) {
      logger.error("Error handling payment webhook:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async createMockPayment(payment) {
    return {
      id: `order_mock_${Date.now()}`,
      amount: payment.amount * 100, // Convert to paise
      currency: payment.currency,
      status: "created",
    };
  }

  async createMockRefund(refund) {
    return {
      id: `refund_mock_${Date.now()}`,
      amount: Math.abs(refund.amount) * 100,
      currency: refund.currency,
      status: "processed",
    };
  }

  async createRazorpayOrder(payment) {
    // Real Razorpay integration would go here
    // const Razorpay = require('razorpay');
    // const razorpay = new Razorpay({
    //   key_id: this.razorpayKeyId,
    //   key_secret: this.razorpayKeySecret
    // });

    // return await razorpay.orders.create({
    //   amount: payment.amount * 100,
    //   currency: payment.currency,
    //   notes: payment.metadata
    // });

    throw new Error("Razorpay integration not implemented");
  }

  async createRazorpayRefund(payment, amount) {
    // Real Razorpay refund integration would go here
    throw new Error("Razorpay refund integration not implemented");
  }

  async handlePaymentSuccess(paymentEntity) {
    const payment = await Payment.findOne({
      where: { gatewayOrderId: paymentEntity.order_id },
    });

    if (payment) {
      await payment.update({
        status: "completed",
        gatewayPaymentId: paymentEntity.id,
        paymentMethod: paymentEntity.method,
        webhookData: paymentEntity,
        paymentDate: new Date(),
      });

      // Calculate commission for service fees
      if (payment.paymentType === "service_fee") {
        payment.calculateCommission();
        await payment.save();
      }

      // Record coupon usage if coupon was applied
      if (payment.couponId) {
        await couponService.recordCouponUsage(
          payment.couponId,
          payment.payerId,
          payment.serviceRequestId,
          payment.id,
          payment.originalAmount,
          payment.discountAmount,
          payment.amount
        );
      }

      await this.clearPaymentCache(payment.id);
    }
  }

  async handlePaymentFailure(paymentEntity) {
    const payment = await Payment.findOne({
      where: { gatewayOrderId: paymentEntity.order_id },
    });

    if (payment) {
      await payment.update({
        status: "failed",
        failureReason: paymentEntity.error_description,
        webhookData: paymentEntity,
        lastRetryAt: new Date(),
        retryCount: payment.retryCount + 1,
      });

      await this.clearPaymentCache(payment.id);
    }
  }

  calculateRefundAmount(payment) {
    const { paymentType, amount, serviceRequest } = payment;

    if (paymentType === "booking_fee") {
      // Booking fee refund based on cancellation policy
      if (["pending", "accepted"].includes(serviceRequest.status)) {
        return amount; // Full refund
      } else {
        return 0; // No refund after CA starts work
      }
    } else if (paymentType === "service_fee") {
      // Service fee refund (rare cases)
      return amount * 0.5; // 50% refund
    }

    return 0;
  }

  async clearPaymentCache(paymentId) {
    try {
      const cacheKey = cacheService.getCacheKeys().PAYMENT_STATUS(paymentId);
      await cacheService.del(cacheKey);
    } catch (error) {
      logger.error("Error clearing payment cache:", error);
    }
  }
}

module.exports = new PaymentService();
