require("dotenv").config();
console.log("✅ Environment loaded");

const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
console.log("✅ Express and HTTP server created");

// Import WebSocket service and notification service
const webSocketService = require("./websocket/chatService");
const notificationService = require("./services/notificationService");
console.log("✅ WebSocket and notification services imported");

// Import middleware
const {
  dynamicCors,
  corsErrorHandler,
  handlePreflightOptions,
  corsSecurityHeaders,
} = require("./middleware/cors");
const {
  securityHeaders,
  sanitizeInput,
  validateRequest,
  preventSQLInjection,
} = require("./middleware/security");
const {
  globalRateLimit,
  logRateLimitViolation,
} = require("./middleware/rateLimit");
const logger = require("./config/logger");

// Import Redis client and connect
const { connectRedis } = require("./redis");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const caRoutes = require("./routes/ca");
const caManagementRoutes = require("./routes/caManagement");
const adminRoutes = require("./routes/admin");
const consultationRoutes = require("./routes/consultations");
const documentRoutes = require("./routes/documents");
const paymentRoutes = require("./routes/payments");
const notificationRoutes = require("./routes/notifications");
const vcRoutes = require("./routes/vc");
const couponRoutes = require("./routes/coupons");
const masterRoutes = require("./routes/masters");

// Security middleware (applied early)
app.use(securityHeaders);
app.use(corsSecurityHeaders);
app.use(handlePreflightOptions);
app.use(dynamicCors);

// Request parsing and size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static file serving for uploads
app.use("/uploads", express.static("uploads"));

// Security and validation middleware
app.use(sanitizeInput);
app.use(validateRequest);
app.use(preventSQLInjection);

// Rate limiting
app.use(logRateLimitViolation);
app.use(globalRateLimit);

// Swagger UI integration
require("./config/swagger")(app);

// Initialize Redis connection (non-blocking)
connectRedis()
  .then(() => {
    logger.info("Redis connected successfully");
  })
  .catch((err) => {
    logger.warn(
      "Redis connection failed - continuing without cache:",
      err.message
    );
    // Continue without Redis - caching will be disabled
  });

// Initialize WebSocket service
const io = webSocketService.initialize(server);

// Set Socket.IO instance for notification service
notificationService.setSocketIO(io);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ca", caRoutes);
app.use("/api/ca-mgmt", caManagementRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/vc", vcRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/masters", masterRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "EaseTax Backend API",
    version: "1.0.0",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "EaseTax Backend API v1",
    documentation: "/docs",
    health: "/health",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Global error handler", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
      },
    });
  }

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    },
  });
});

// CORS error handler
app.use(corsErrorHandler);

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ENDPOINT_NOT_FOUND",
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// Start the server
const httpServer = server.listen(PORT, () => {
  logger.info(`EaseTax Backend API server running on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    documentation: `http://localhost:${PORT}/docs`,
  });
  console.log(`🚀 SERVER RUNNING on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  httpServer.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  httpServer.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});
