require("dotenv").config();
const env = process.env.NODE_ENV || "development";
console.log(`🚀 STARTING SERVER in ${env} mode`);

// 1.5 Log environment variables for debugging (Masking sensitive data)
console.log("📋 Checking Environment Variables:");
const sensitiveKeys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"];
Object.keys(process.env).forEach((key) => {
  const isSensitive = sensitiveKeys.some((s) => key.includes(s));
  const value = process.env[key];
  if (isSensitive && value) {
    const masked =
      value.length > 8
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : "****";
    console.log(`   ${key}: ${masked} (length: ${value.length})`);
  } else {
    console.log(`   ${key}: ${value}`);
  }
});

// 2. Initialize logger early to capture startup errors
const logger = require("./config/logger");
console.log("✅ Logger initialized");

// 3. Register global error handlers before anything else
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
  logger.error("Unhandled Rejection", {
    reason: reason.message || reason,
    stack: reason.stack,
  });
});

process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// 4. Basic imports
console.log("📦 Importing core dependencies...");
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
console.log("✅ Core dependencies loaded");

// 5. Service imports (The likely hang point)
console.log("📦 Loading WebSocket service...");
const webSocketService = require("./websocket/chatService");
console.log("✅ WebSocket service loaded");

console.log("📦 Loading Notification service...");
const notificationService = require("./services/notificationService");
console.log("✅ Notification service loaded");

// 6. Middleware imports
console.log("📦 Loading middlewares...");
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
console.log("✅ Middlewares loaded");

// 7. DB and Redis imports
const { connectRedis } = require("./redis");
const redisManager = require("./config/redis");

// 8. Route imports
console.log("📦 Loading routes...");
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
console.log("✅ Routes loaded");

// Security middleware
app.use(securityHeaders);
app.use(corsSecurityHeaders);
app.use(handlePreflightOptions);
app.use(dynamicCors);

// Request parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static("uploads"));

// Security and validation
app.use(sanitizeInput);
app.use(validateRequest);
app.use(preventSQLInjection);
app.use(logRateLimitViolation);
app.use(globalRateLimit);

// Swagger
require("./config/swagger")(app);

// Connections
console.log("🔌 Initializing connections...");
connectRedis().catch((err) => logger.warn("Redis connection warning:", err));
redisManager
  .connect()
  .catch((err) => logger.warn("Redis Manager connection warning:", err));

// Initialize WS
const io = webSocketService.initialize(server);
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

// Health check
const healthCheck = (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "EaseTax Backend API",
    redis: redisManager.isConnected ? "connected" : "disconnected",
  });
};

app.get("/health", healthCheck);
app.get("/api/health", healthCheck);

app.get("/", (req, res) => res.json({ message: "EaseTax Backend API v1" }));

// Error handling
app.use((err, req, res, next) => {
  logger.error("Global error handler", {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res
    .status(500)
    .json({ success: false, error: { message: "Internal server error" } });
});
app.use(corsErrorHandler);

// Start
server.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING on http://localhost:${PORT}`);
  logger.info(`Server started on port ${PORT}`);
});

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(() => process.exit(0));
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
