const { Payment, ServiceRequest, User, CA } = require("../../models");
const { Op } = require("sequelize");
const cacheService = require("./cacheService");
const couponService = require("./couponService");
const logger = require("../config/logger");
const crypto = require("crypto");
const Razorpay = require("razorpay");

class PaymentService {
  constructor() {
    this.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    this.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Commission rates
    this.platformCommission = 0.08; // 8%
    this.bookingFee = 999; // ₹999
    this.gstRate = 0.18; // 18% GST

    // Initialize Razorpay instance if credentials are available
    if (this.razorpayKeyId && this.razorpayKeySecret) {
      this.razorpay = new Razorpay({
        key_id: this.razorpayKeyId,
        key_secret: this.razorpayKeySecret,
      });
    }

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
      // Payment can be initiated when status is "accepted" or "in_progress" (after CA acceptance)
      const allowedStatuses = ["accepted", "in_progress"];
      if (!allowedStatuses.includes(serviceRequest.status)) {
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
        // If payment exists but has no gateway order, create one
        if (!existingPayment.gatewayOrderId) {
          try {
            // Ensure keyId is available
            if (!this.razorpayKeyId) {
              throw new Error("Payment gateway configuration error: Razorpay Key ID is missing");
            }

            let paymentGatewayResponse;
            if (this.mockMode) {
              paymentGatewayResponse = await this.createMockPayment(existingPayment);
            } else {
              if (!this.razorpay) {
                throw new Error("Razorpay not initialized. Please check API keys.");
              }
              paymentGatewayResponse = await this.createRazorpayOrder(existingPayment);
            }

            await existingPayment.update({
              gatewayOrderId: paymentGatewayResponse.id,
              webhookData: paymentGatewayResponse,
            });

            return {
              paymentId: existingPayment.id,
              orderId: paymentGatewayResponse.id,
              amount: existingPayment.amount,
              originalAmount: existingPayment.originalAmount,
              discountAmount: existingPayment.discountAmount,
              baseAmount: baseBookingFee,
              gstAmount: gstAmount,
              currency: existingPayment.currency,
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
            logger.error("Failed to create gateway order for existing payment:", {
              error,
              errorMessage: error?.message,
              paymentId: existingPayment.id,
            });
            // Delete the existing payment and create a new one
            await existingPayment.destroy();
          }
        } else {
          // Payment exists with gateway order, return proper structure
          return {
            paymentId: existingPayment.id,
            orderId: existingPayment.gatewayOrderId,
            amount: existingPayment.amount,
            originalAmount: existingPayment.originalAmount,
            discountAmount: existingPayment.discountAmount,
            baseAmount: baseBookingFee,
            gstAmount: gstAmount,
            currency: existingPayment.currency,
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
        }
      }

      // Booking fee: ₹999 + 18% GST
      const baseBookingFee = this.bookingFee;
      const gstAmount = baseBookingFee * this.gstRate;
      let amount = baseBookingFee + gstAmount; // Total: 999 + GST
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

      // Ensure keyId is available before proceeding
      if (!this.razorpayKeyId) {
        logger.error("Razorpay Key ID is not configured");
        throw new Error("Payment gateway configuration error: Razorpay Key ID is missing");
      }

      let paymentGatewayResponse;

      try {
        if (this.mockMode) {
          // Mock payment for development
          paymentGatewayResponse = await this.createMockPayment(payment);
        } else {
          // Real Razorpay integration
          if (!this.razorpay) {
            throw new Error("Razorpay not initialized. Please check API keys.");
          }
          paymentGatewayResponse = await this.createRazorpayOrder(payment);
        }

        // Update payment with gateway details
        await payment.update({
          gatewayOrderId: paymentGatewayResponse.id,
          webhookData: paymentGatewayResponse,
        });
      } catch (gatewayError) {
        // If gateway order creation fails, delete the payment record and rethrow
        logger.error("Failed to create payment gateway order:", {
          error: gatewayError,
          errorMessage: gatewayError?.message,
          paymentId: payment.id,
        });
        await payment.destroy();
        const errorMessage = gatewayError?.message || gatewayError?.toString() || "Unknown error occurred";
        throw new Error(`Failed to create payment gateway order: ${errorMessage}`);
      }

      return {
        paymentId: payment.id,
        orderId: paymentGatewayResponse.id,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        discountAmount: payment.discountAmount,
        baseAmount: baseBookingFee, // Base amount before GST
        gstAmount: gstAmount, // GST amount
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

      // Calculate final amount (total - booking fee already paid)
      // Get service price from CAService
      const CAService = require("../../models").CAService;
      let servicePrice = null;
      if (serviceRequest.caServiceId) {
        const caService = await CAService.findByPk(serviceRequest.caServiceId);
        if (caService?.customPrice) {
          servicePrice = parseFloat(caService.customPrice);
        }
      }
      
      const totalAmount = servicePrice || 2500; // Fallback
      // Final amount: (Service amount - booking fee) + GST
      const baseFinalAmount = totalAmount - this.bookingFee;
      const finalGstAmount = baseFinalAmount * this.gstRate;

      if (existingPayment) {
        // If payment exists but has no gateway order, create one
        if (!existingPayment.gatewayOrderId) {
          try {
            // Ensure keyId is available
            if (!this.razorpayKeyId) {
              throw new Error("Payment gateway configuration error: Razorpay Key ID is missing");
            }

            let paymentGatewayResponse;
            if (this.mockMode) {
              paymentGatewayResponse = await this.createMockPayment(existingPayment);
            } else {
              if (!this.razorpay) {
                throw new Error("Razorpay not initialized. Please check API keys.");
              }
              paymentGatewayResponse = await this.createRazorpayOrder(existingPayment);
            }

            await existingPayment.update({
              gatewayOrderId: paymentGatewayResponse.id,
              webhookData: paymentGatewayResponse,
            });

            return {
              paymentId: existingPayment.id,
              orderId: paymentGatewayResponse.id,
              amount: existingPayment.amount,
              originalAmount: existingPayment.originalAmount,
              discountAmount: existingPayment.discountAmount,
              baseAmount: baseFinalAmount,
              gstAmount: finalGstAmount,
              commissionAmount: existingPayment.commissionAmount,
              netAmount: existingPayment.netAmount,
              currency: existingPayment.currency,
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
            logger.error("Failed to create gateway order for existing payment:", {
              error,
              errorMessage: error?.message,
              paymentId: existingPayment.id,
            });
            // Delete the existing payment and create a new one
            await existingPayment.destroy();
          }
        } else {
          // Payment exists with gateway order, return proper structure
          return {
            paymentId: existingPayment.id,
            orderId: existingPayment.gatewayOrderId,
            amount: existingPayment.amount,
            originalAmount: existingPayment.originalAmount,
            discountAmount: existingPayment.discountAmount,
            baseAmount: baseFinalAmount,
            gstAmount: finalGstAmount,
            commissionAmount: existingPayment.commissionAmount,
            netAmount: existingPayment.netAmount,
            currency: existingPayment.currency,
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
        }
      }

      if (baseFinalAmount <= 0) {
        throw new Error("No additional payment required");
      }

      // Calculate final amount with GST
      let finalAmount = baseFinalAmount + finalGstAmount; // (Service - 999) + GST

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

      // Ensure keyId is available
      if (!this.razorpayKeyId) {
        logger.error("Razorpay Key ID is not configured");
        throw new Error("Payment gateway configuration error: Razorpay Key ID is missing");
      }

      return {
        paymentId: payment.id,
        orderId: paymentGatewayResponse.id,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        discountAmount: payment.discountAmount,
        baseAmount: baseFinalAmount, // Base amount before GST
        gstAmount: finalGstAmount, // GST amount
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

      if (payment.payerId !== userId) {
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

      // If webhook secret is not configured, log warning but allow (for development)
      if (!this.webhookSecret) {
        logger.warn("RAZORPAY_WEBHOOK_SECRET not configured. Webhook verification skipped.");
        return true; // Allow in development, but should be configured for production
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
      const { event, payload: webhookPayload } = payload;

      logger.info("Razorpay webhook received", { event, payload: webhookPayload });

      if (event === "payment.captured") {
        const paymentEntity = webhookPayload?.payment?.entity || webhookPayload;
        await this.handlePaymentSuccess(paymentEntity);
      } else if (event === "payment.failed") {
        const paymentEntity = webhookPayload?.payment?.entity || webhookPayload;
        await this.handlePaymentFailure(paymentEntity);
      } else if (event === "order.paid") {
        // Handle order paid event
        const orderEntity = webhookPayload?.order?.entity || webhookPayload;
        await this.handleOrderPaid(orderEntity);
      } else {
        logger.warn("Unhandled webhook event", { event });
      }

      return true;
    } catch (error) {
      logger.error("Error handling payment webhook:", error);
      throw error;
    }
  }

  /**
   * Handle order paid event
   */
  async handleOrderPaid(orderEntity) {
    try {
      const payment = await Payment.findOne({
        where: { gatewayOrderId: orderEntity.id },
      });

      if (payment && payment.status === "pending") {
        // Fetch payment details from Razorpay
        if (this.razorpay && orderEntity.id) {
          const payments = await this.razorpay.orders.fetchPayments(orderEntity.id);
          if (payments && payments.items && payments.items.length > 0) {
            const paymentEntity = payments.items[0];
            await this.handlePaymentSuccess(paymentEntity);
          }
        }
      }
    } catch (error) {
      logger.error("Error handling order paid:", error);
    }
  }

  /**
   * Verify payment signature
   */
  async verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      if (this.mockMode) {
        return true; // Skip verification in mock mode
      }

      const text = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", this.razorpayKeySecret)
        .update(text)
        .digest("hex");

      return expectedSignature === signature;
    } catch (error) {
      logger.error("Error verifying payment signature:", error);
      return false;
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
    try {
      if (!this.razorpay) {
        throw new Error("Razorpay not initialized. Please check API keys.");
      }

      // Generate receipt ID (max 40 chars for Razorpay)
      // Use first 32 chars of payment ID (UUID is 36 chars, so this gives us room for prefix)
      const receiptId = payment.id.replace(/-/g, '').substring(0, 32); // Remove dashes and take first 32 chars
      const receipt = `rcpt_${receiptId}`; // Total: 5 + 32 = 37 chars (under 40 limit)
      
      const orderOptions = {
        amount: Math.round(payment.amount * 100), // Convert to paise
        currency: payment.currency || "INR",
        receipt: receipt,
        notes: {
          paymentId: payment.id,
          serviceRequestId: payment.serviceRequestId,
          paymentType: payment.paymentType,
          ...payment.metadata,
        },
      };

      const order = await this.razorpay.orders.create(orderOptions);
      logger.info("Razorpay order created", { orderId: order.id, paymentId: payment.id });

      return order;
    } catch (error) {
      logger.error("Error creating Razorpay order:", {
        error,
        errorMessage: error?.message,
        errorDescription: error?.error?.description,
        errorCode: error?.error?.code,
        errorReason: error?.error?.reason,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      
      // Extract error message from various possible error structures
      const errorMessage = 
        error?.error?.description || 
        error?.error?.reason || 
        error?.message || 
        error?.toString() || 
        "Unknown error occurred";
      
      throw new Error(`Failed to create Razorpay order: ${errorMessage}`);
    }
  }

  async createRazorpayRefund(payment, amount) {
    try {
      if (!this.razorpay) {
        throw new Error("Razorpay not initialized. Please check API keys.");
      }

      if (!payment.gatewayPaymentId) {
        throw new Error("Payment gateway ID not found. Cannot process refund.");
      }

      const refundOptions = {
        payment_id: payment.gatewayPaymentId,
        amount: Math.round(Math.abs(amount) * 100), // Convert to paise
        notes: {
          paymentId: payment.id,
          refundReason: payment.metadata?.refundReason || "User requested refund",
        },
      };

      const refund = await this.razorpay.payments.refund(
        payment.gatewayPaymentId,
        refundOptions
      );

      logger.info("Razorpay refund created", {
        refundId: refund.id,
        paymentId: payment.id,
        amount: refund.amount,
      });

      return refund;
    } catch (error) {
      logger.error("Error creating Razorpay refund:", {
        error,
        errorMessage: error?.message,
        errorDescription: error?.error?.description,
      });
      const errorMessage = error?.error?.description || error?.message || error?.toString() || "Unknown error occurred";
      throw new Error(`Failed to create Razorpay refund: ${errorMessage}`);
    }
  }

  async handlePaymentSuccess(paymentEntity) {
    try {
      const orderId = paymentEntity.order_id || paymentEntity.id;
      const payment = await Payment.findOne({
        where: { gatewayOrderId: orderId },
      });

      if (!payment) {
        logger.warn("Payment not found for webhook", { orderId });
        return;
      }

      if (payment.status === "completed") {
        logger.info("Payment already completed", { paymentId: payment.id });
        return;
      }

      await payment.update({
        status: "completed",
        gatewayPaymentId: paymentEntity.id || paymentEntity.razorpay_payment_id,
        paymentMethod: paymentEntity.method || paymentEntity.payment_method,
        transactionReference: paymentEntity.id,
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

      // Update service request status if needed
      const serviceRequest = await ServiceRequest.findByPk(payment.serviceRequestId);
      if (serviceRequest) {
        if (payment.paymentType === "booking_fee" && serviceRequest.status === "accepted") {
          // Service request can move to next stage after booking payment
          // You can add logic here to update service request status
        }
      }

      await this.clearPaymentCache(payment.id);
      logger.info("Payment success handled", { paymentId: payment.id });
    } catch (error) {
      logger.error("Error handling payment success:", error);
      throw error;
    }
  }

  async handlePaymentFailure(paymentEntity) {
    try {
      const orderId = paymentEntity.order_id || paymentEntity.id;
      const payment = await Payment.findOne({
        where: { gatewayOrderId: orderId },
      });

      if (!payment) {
        logger.warn("Payment not found for failure webhook", { orderId });
        return;
      }

      await payment.update({
        status: "failed",
        failureReason:
          paymentEntity.error_description ||
          paymentEntity.error?.description ||
          paymentEntity.error?.reason ||
          "Payment failed",
        webhookData: paymentEntity,
        lastRetryAt: new Date(),
        retryCount: payment.retryCount + 1,
      });

      await this.clearPaymentCache(payment.id);
      logger.info("Payment failure handled", { paymentId: payment.id });
    } catch (error) {
      logger.error("Error handling payment failure:", error);
      throw error;
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

  /**
   * Verify payment signature and update payment status
   */
  async verifyPayment(paymentId, userId, orderId, paymentIdFromGateway, signature) {
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

      if (payment.payerId !== userId) {
        throw new Error("Access denied");
      }

      // Verify signature
      const isValid = await this.verifyPaymentSignature(
        orderId,
        paymentIdFromGateway,
        signature
      );

      if (!isValid) {
        throw new Error("Invalid payment signature");
      }

      // Verify order ID matches
      if (payment.gatewayOrderId !== orderId) {
        throw new Error("Order ID mismatch");
      }

      // If payment is already completed, return current status
      if (payment.status === "completed") {
        return await this.getPaymentStatus(paymentId);
      }

      // Fetch payment details from Razorpay to confirm
      if (this.razorpay) {
        try {
          const razorpayPayment = await this.razorpay.payments.fetch(paymentIdFromGateway);
          
          if (razorpayPayment.status === "captured" || razorpayPayment.status === "authorized") {
            await this.handlePaymentSuccess(razorpayPayment);
          } else if (razorpayPayment.status === "failed") {
            await this.handlePaymentFailure(razorpayPayment);
          }
        } catch (razorpayError) {
          logger.error("Error fetching payment from Razorpay:", razorpayError);
          // Continue with signature verification if Razorpay fetch fails
        }
      }

      // Update payment with gateway payment ID if not already set
      if (!payment.gatewayPaymentId) {
        await payment.update({
          gatewayPaymentId: paymentIdFromGateway,
          transactionReference: paymentIdFromGateway,
        });
      }

      // Refresh payment status
      return await this.getPaymentStatus(paymentId);
    } catch (error) {
      logger.error("Error verifying payment:", error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
