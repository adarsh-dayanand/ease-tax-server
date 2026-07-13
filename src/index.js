require("dotenv").config();
const env = process.env.NODE_ENV || "development";
console.log(`🚀 STARTING SERVER in ${env} mode`);

// 2. Initialize logger early to capture startup errors
const logger = require("./config/logger");

// 3. Register global error handlers before anything else
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
  logger.error("Unhandled Rejection", {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });

  // In production, exit so the orchestrator can replace a corrupted process
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
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
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Trust reverse proxies (ALB / nginx) so req.ip and rate limits are correct
app.set("trust proxy", 1);

// 5. Service imports
const webSocketService = require("./websocket/chatService");
const notificationService = require("./services/notificationService");
const { sequelize } = require("../models");

// 6. Middleware imports
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

// 7. Route imports
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
const inquiryRoutes = require("./routes/inquiry");

// Security middleware
app.use(securityHeaders);
app.use(corsSecurityHeaders);
app.use(handlePreflightOptions);
app.use(dynamicCors);

// Request parsing — capture raw body for Razorpay HMAC on the webhook path
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      if (req.originalUrl?.startsWith("/api/payments/webhook")) {
        req.rawBody = buf.toString("utf8");
      }
    },
  }),
);
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
app.use("/api/inquiry", inquiryRoutes);

// Health check — include DB so load balancers do not route to a broken task
const healthCheck = async (req, res) => {
  const payload = {
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "EaseTax Backend API",
    database: "unknown",
  };

  try {
    await sequelize.query("SELECT 1");
    payload.database = "up";
    return res.json(payload);
  } catch (error) {
    payload.status = "DEGRADED";
    payload.database = "down";
    logger.error("Health check DB ping failed", { error: error.message });
    return res.status(503).json(payload);
  }
};

app.get("/health", healthCheck);
app.get("/api/health", healthCheck);

app.get("/api", (req, res) => res.json({ message: "EaseTax Backend API v1" }));
app.get("/", (req, res) => res.json({ message: "EaseTax Backend API v1" }));

// CORS error handling MUST come before the global error handler
app.use(corsErrorHandler);

// Global Error handling
app.use((err, req, res, next) => {
  logger.error("Global error handler caught an error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // If headers already sent, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    error: {
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
      code: err.code || "INTERNAL_ERROR",
    },
  });
});

async function connectDatabase(retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      logger.info("Database connection established");
      console.log("✅ Database connection established");
      return;
    } catch (error) {
      logger.error(`Database connect attempt ${attempt}/${retries} failed`, {
        error: error.message,
      });
      console.error(
        `❌ Database connect attempt ${attempt}/${retries}: ${error.message}`,
      );
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function shutdown(signal) {
  logger.info(`${signal} received: closing HTTP server`);
  server.close(async () => {
    try {
      if (io) {
        await new Promise((resolve) => io.close(resolve));
      }
      await sequelize.close();
      logger.info("HTTP server and database connections closed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown", {
        error: error.message,
      });
      process.exit(1);
    }
  });

  // Force exit if connections hang
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
}

async function start() {
  await connectDatabase();

  server.listen(PORT, () => {
    console.log(`🚀 SERVER RUNNING on http://localhost:${PORT}`);
    logger.info(`Server started on port ${PORT}`);
    logger.info("WebSocket service initialized");
  });
}

start().catch((error) => {
  console.error("❌ Failed to start server:", error);
  logger.error("Failed to start server", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
