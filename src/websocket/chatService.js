const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Message, ServiceRequest, User, CA } = require("../../models");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userRooms = new Map(); // userId -> Set of roomIds
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user details
        let user;
        if (decoded.role === "ca") {
          user = await CA.findByPk(decoded.id);
        } else {
          user = await User.findByPk(decoded.id);
        }

        if (!user) {
          return next(new Error("User not found"));
        }

        socket.userId = decoded.id;
        socket.userType = decoded.role || "user";
        socket.userName = user.name;

        next();
      } catch (error) {
        logger.error("WebSocket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });

    // Connection handling
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });

    logger.info("WebSocket service initialized");

    return this.io;
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const userId = socket.userId;
    const userType = socket.userType;

    logger.info(`User connected: ${userId} (${userType})`);

    // Store connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Handle joining service request rooms
    socket.on("join_service_request", async (data) => {
      await this.handleJoinServiceRequest(socket, data);
    });

    // Handle leaving service request rooms
    socket.on("leave_service_request", async (data) => {
      await this.handleLeaveServiceRequest(socket, data);
    });

    // Handle sending messages
    socket.on("send_message", async (data) => {
      await this.handleSendMessage(socket, data);
    });

    // Handle typing indicators
    socket.on("typing_start", (data) => {
      this.handleTyping(socket, data, true);
    });

    socket.on("typing_stop", (data) => {
      this.handleTyping(socket, data, false);
    });

    // Handle message read receipts
    socket.on("mark_messages_read", async (data) => {
      await this.handleMarkMessagesRead(socket, data);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });

    // Send welcome message
    socket.emit("connected", {
      message: "Connected to EaseTax chat service",
      userId: userId,
      userType: userType,
    });
  }

  /**
   * Handle joining a service request chat room
   */
  async handleJoinServiceRequest(socket, data) {
    try {
      const { serviceRequestId } = data;

      // Verify user has access to this service request
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId);

      if (!serviceRequest) {
        socket.emit("error", { message: "Service request not found" });
        return;
      }

      // Check if user is part of this service request
      if (
        serviceRequest.userId !== socket.userId &&
        serviceRequest.caId !== socket.userId
      ) {
        socket.emit("error", {
          message: "Access denied to this service request",
        });
        return;
      }

      const roomId = `service_request:${serviceRequestId}`;

      // Join room
      socket.join(roomId);

      // Track user rooms
      if (!this.userRooms.has(socket.userId)) {
        this.userRooms.set(socket.userId, new Set());
      }
      this.userRooms.get(socket.userId).add(roomId);

      // Get recent messages
      const messages = await this.getRecentMessages(serviceRequestId);

      // Send recent messages to user
      socket.emit("service_request_joined", {
        serviceRequestId,
        messages,
        message: "Joined service request chat",
      });

      // Notify others in the room
      socket.to(roomId).emit("user_joined", {
        userId: socket.userId,
        userName: socket.userName,
        userType: socket.userType,
      });

      logger.info(
        `User ${socket.userId} joined service request ${serviceRequestId}`
      );
    } catch (error) {
      logger.error("Error joining service request:", error);
      socket.emit("error", { message: "Failed to join service request" });
    }
  }

  /**
   * Handle leaving a service request chat room
   */
  async handleLeaveServiceRequest(socket, data) {
    try {
      const { serviceRequestId } = data;
      const roomId = `service_request:${serviceRequestId}`;

      // Leave room
      socket.leave(roomId);

      // Update user rooms tracking
      if (this.userRooms.has(socket.userId)) {
        this.userRooms.get(socket.userId).delete(roomId);
      }

      // Notify others in the room
      socket.to(roomId).emit("user_left", {
        userId: socket.userId,
        userName: socket.userName,
        userType: socket.userType,
      });

      socket.emit("service_request_left", { serviceRequestId });

      logger.info(
        `User ${socket.userId} left service request ${serviceRequestId}`
      );
    } catch (error) {
      logger.error("Error leaving service request:", error);
      socket.emit("error", { message: "Failed to leave service request" });
    }
  }

  /**
   * Handle sending messages
   */
  async handleSendMessage(socket, data) {
    try {
      const {
        serviceRequestId,
        content,
        messageType = "text",
        attachmentUrl = null,
      } = data;

      // Verify access
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId);
      if (
        !serviceRequest ||
        (serviceRequest.userId !== socket.userId &&
          serviceRequest.caId !== socket.userId)
      ) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      // Determine receiver
      const receiverId =
        serviceRequest.userId === socket.userId
          ? serviceRequest.caId
          : serviceRequest.userId;
      const receiverType =
        serviceRequest.userId === socket.userId ? "ca" : "user";

      // Save message to database
      const message = await Message.create({
        serviceRequestId,
        senderId: socket.userId,
        senderType: socket.userType,
        receiverId,
        receiverType,
        messageType,
        content,
        attachmentUrl,
        attachmentType: attachmentUrl
          ? this.getAttachmentType(attachmentUrl)
          : null,
        isDelivered: this.isUserOnline(receiverId),
        deliveredAt: this.isUserOnline(receiverId) ? new Date() : null,
      });

      // Clear message cache
      const cacheKey = cacheService
        .getCacheKeys()
        .CONSULTATION_MESSAGES(serviceRequestId);
      await cacheService.del(cacheKey);

      // Prepare message data
      const messageData = {
        id: message.id,
        serviceRequestId,
        senderId: socket.userId,
        senderName: socket.userName,
        senderType: socket.userType,
        content,
        messageType,
        attachmentUrl,
        timestamp: message.createdAt,
        isDelivered: message.isDelivered,
        isRead: false,
      };

      // Send to room
      const roomId = `service_request:${serviceRequestId}`;
      this.io.to(roomId).emit("new_message", messageData);

      // Send push notification to offline users
      if (!this.isUserOnline(receiverId)) {
        await this.sendPushNotification(receiverId, {
          title: `New message from ${socket.userName}`,
          body: messageType === "text" ? content : "Sent an attachment",
          serviceRequestId,
        });
      }

      logger.info(
        `Message sent in service request ${serviceRequestId} by ${socket.userId}`
      );
    } catch (error) {
      logger.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  }

  /**
   * Handle typing indicators
   */
  handleTyping(socket, data, isTyping) {
    try {
      const { serviceRequestId } = data;
      const roomId = `service_request:${serviceRequestId}`;

      socket.to(roomId).emit("typing_indicator", {
        userId: socket.userId,
        userName: socket.userName,
        isTyping,
      });
    } catch (error) {
      logger.error("Error handling typing indicator:", error);
    }
  }

  /**
   * Handle marking messages as read
   */
  async handleMarkMessagesRead(socket, data) {
    try {
      const { serviceRequestId, messageIds } = data;

      // Verify access
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId);
      if (
        !serviceRequest ||
        (serviceRequest.userId !== socket.userId &&
          serviceRequest.caId !== socket.userId)
      ) {
        return;
      }

      // Mark messages as read
      await Message.update(
        {
          isRead: true,
          readAt: new Date(),
        },
        {
          where: {
            id: messageIds || { [require("sequelize").Op.ne]: null },
            serviceRequestId,
            receiverId: socket.userId,
            isRead: false,
          },
        }
      );

      // Clear cache
      const cacheKey = cacheService
        .getCacheKeys()
        .CONSULTATION_MESSAGES(serviceRequestId);
      await cacheService.del(cacheKey);

      // Notify sender about read receipts
      const roomId = `service_request:${serviceRequestId}`;
      socket.to(roomId).emit("messages_read", {
        serviceRequestId,
        readBy: socket.userId,
        readAt: new Date(),
      });
    } catch (error) {
      logger.error("Error marking messages as read:", error);
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(socket) {
    const userId = socket.userId;

    // Remove from connected users
    this.connectedUsers.delete(userId);

    // Clean up user rooms
    this.userRooms.delete(userId);

    logger.info(`User disconnected: ${userId}`);
  }

  /**
   * Get recent messages for a service request
   */
  async getRecentMessages(serviceRequestId, limit = 50) {
    try {
      const messages = await Message.findAll({
        where: {
          serviceRequestId,
          isDeleted: false,
        },
        order: [["createdAt", "DESC"]],
        limit,
        include: [
          {
            model: User,
            as: "senderUser",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: CA,
            as: "senderCA",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      return messages.reverse().map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderUser?.name || message.senderCA?.name,
        senderType: message.senderType,
        content: message.content,
        messageType: message.messageType,
        attachmentUrl: message.attachmentUrl,
        timestamp: message.createdAt,
        isDelivered: message.isDelivered,
        isRead: message.isRead,
      }));
    } catch (error) {
      logger.error("Error getting recent messages:", error);
      return [];
    }
  }

  /**
   * Utility methods
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  getAttachmentType(url) {
    const extension = url.split(".").pop().toLowerCase();
    const imageTypes = ["jpg", "jpeg", "png", "gif", "bmp"];
    const documentTypes = ["pdf", "doc", "docx", "xls", "xlsx"];

    if (imageTypes.includes(extension)) return "image";
    if (documentTypes.includes(extension)) return "document";
    return "file";
  }

  async sendPushNotification(userId, notificationData) {
    try {
      // This would integrate with your notification service
      // For now, just log the notification
      logger.info(`Push notification for user ${userId}:`, notificationData);
    } catch (error) {
      logger.error("Error sending push notification:", error);
    }
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Send message to service request room
   */
  sendToServiceRequest(serviceRequestId, event, data) {
    this.io.to(`service_request:${serviceRequestId}`).emit(event, data);
  }

  /**
   * Get online users in a service request
   */
  getOnlineUsersInServiceRequest(serviceRequestId) {
    const roomId = `service_request:${serviceRequestId}`;
    const room = this.io.sockets.adapter.rooms.get(roomId);

    if (!room) return [];

    const onlineUsers = [];
    for (const socketId of room) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        onlineUsers.push({
          userId: socket.userId,
          userName: socket.userName,
          userType: socket.userType,
        });
      }
    }

    return onlineUsers;
  }
}

module.exports = new WebSocketService();
