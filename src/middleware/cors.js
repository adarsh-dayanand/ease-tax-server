const cors = require("cors");
const logger = require("../config/logger");

/**
 * CORS configuration based on environment
 */
const getCorsOptions = () => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const websocketOrigin = process.env.WEBSOCKET_CORS_ORIGIN || frontendUrl;

  // Development - Allow all origins
  if (isDevelopment) {
    return {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "Cache-Control",
        "X-New-Token",
        "Access-Control-Allow-Origin",
      ],
      exposedHeaders: ["X-New-Token"],
      optionsSuccessStatus: 200,
      preflightContinue: false,
    };
  }

  // Production - Specific origins only
  const allowedOrigins = [
    frontendUrl,
    websocketOrigin,
    // Add production domains here
    "https://easetax.co.in",
    "https://www.easetax.co.in",
    "https://app.easetax.co.in",
    "https://service.easetax.co.in",
    "http://easetax.co.in",
    "http://www.easetax.co.in",
    "http://app.easetax.co.in",
    "http://service.easetax.co.in",
  ].filter(Boolean);

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, it hits the server directly)
      if (!origin) {
        return callback(null, true);
      }

      // Exact match check
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Subdomain check (optional but safer for dev)
      const isAllowedSubdomain = allowedOrigins.some((allowed) => {
        if (!allowed || typeof allowed !== "string") return false;
        return origin.endsWith(allowed.replace(/^https?:\/\//, ""));
      });

      if (isAllowedSubdomain) {
        return callback(null, true);
      }

      logger.warn(`CORS blocked origin: ${origin}`, {
        allowedOrigins: allowedOrigins,
        originType: typeof origin,
      });

      const corsError = new Error("Not allowed by CORS");
      corsError.status = 403;
      callback(corsError);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "X-New-Token",
    ],
    exposedHeaders: ["X-New-Token"],
    optionsSuccessStatus: 200,
    preflightContinue: false,
  };
};

/**
 * CORS middleware for API routes
 */
const apiCors = cors(getCorsOptions());

/**
 * CORS middleware for WebSocket connections
 */
const websocketCors = (origin, callback) => {
  const corsOptions = getCorsOptions();

  if (corsOptions.origin === true) {
    // Development mode - allow all
    callback(null, true);
    return;
  }

  if (typeof corsOptions.origin === "function") {
    corsOptions.origin(origin, callback);
  } else if (Array.isArray(corsOptions.origin)) {
    if (corsOptions.origin.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  } else {
    callback(null, true);
  }
};

/**
 * CORS middleware for file uploads
 */
const uploadCors = cors({
  ...getCorsOptions(),
  methods: ["POST", "OPTIONS"],
  maxAge: 86400, // 24 hours preflight cache
});

/**
 * CORS middleware for webhooks (more restrictive)
 */
const webhookCors = cors({
  origin: [
    // Payment gateway IPs/domains
    "https://api.razorpay.com",
    "https://api.phonepe.com",
    "https://api.cashfree.com",
    // Add other webhook sources
  ],
  methods: ["POST"],
  credentials: false,
  optionsSuccessStatus: 200,
});

/**
 * Dynamic CORS based on route
 */
const dynamicCors = (req, res, next) => {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Webhook routes
  if (path.includes("/webhook")) {
    return webhookCors(req, res, next);
  }

  // Upload routes - only for POST requests
  // For DELETE/GET requests on document routes, use apiCors
  if (
    (path.includes("/upload") || path.includes("/document")) &&
    method === "POST"
  ) {
    return uploadCors(req, res, next);
  }

  // Default API CORS (handles GET, DELETE, PUT, PATCH, etc.)
  return apiCors(req, res, next);
};

/**
 * Custom CORS error handler
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    logger.warn("CORS error", {
      origin: req.get("Origin"),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    return res.status(403).json({
      success: false,
      error: {
        code: "CORS_NOT_ALLOWED",
        message: "Cross-origin request not allowed",
      },
    });
  }

  next(err);
};

/**
 * Pre-flight OPTIONS handler
 */
const handlePreflightOptions = (req, res, next) => {
  if (req.method === "OPTIONS") {
    // Route preflight through the dynamic CORS handler so the configured
    // cors middleware (apiCors / uploadCors / webhookCors) can set the
    // appropriate Access-Control-* response headers. After cors runs,
    // finish the preflight with 200 and a sensible cache TTL.
    return dynamicCors(req, res, () => {
      // Set additional headers for preflight responses
      res.header("Access-Control-Max-Age", "86400"); // 24 hours
      res.header(
        "Vary",
        "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
      );

      return res.status(200).end();
    });
  }

  next();
};

/**
 * Security headers for CORS
 */
const corsSecurityHeaders = (req, res, next) => {
  // Prevent CSRF attacks
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("X-XSS-Protection", "1; mode=block");

  // Only allow HTTPS in production
  if (process.env.NODE_ENV === "production") {
    res.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  next();
};

module.exports = {
  apiCors,
  websocketCors,
  uploadCors,
  webhookCors,
  dynamicCors,
  corsErrorHandler,
  handlePreflightOptions,
  corsSecurityHeaders,
  getCorsOptions,
};
