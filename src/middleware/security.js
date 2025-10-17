const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss");
const logger = require("../config/logger");

/**
 * Security configuration based on environment
 */
const getSecurityConfig = () => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  return {
    // Content Security Policy - only enable in production with safe directives
    ...(isDevelopment
      ? {}
      : {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
              ],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "https:", "blob:"],
              scriptSrc: ["'self'"],
              connectSrc: [
                "'self'",
                frontendUrl,
                "https://api.razorpay.com",
                "wss:",
                "ws:",
              ],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
            },
          },
        }),

    // Cross Origin Embedder Policy
    crossOriginEmbedderPolicy: false,

    // Cross Origin Resource Policy
    crossOriginResourcePolicy: { policy: "cross-origin" },

    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },

    // Hide X-Powered-By header
    hidePoweredBy: true,

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // X-Frame-Options
    frameguard: { action: "deny" },

    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: false,

    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,
  };
};

/**
 * Main security middleware using Helmet
 */
const securityHeaders = helmet(getSecurityConfig());

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  try {
    // Apply mongo-sanitize to body only (avoid read-only req.query)
    if (req.body && typeof req.body === "object") {
      mongoSanitize.sanitize(req.body);
      req.body = sanitizeObject(req.body);
    }

    // For query parameters, create a sanitized copy
    if (req.query && typeof req.query === "object") {
      const sanitizedQuery = sanitizeObject({ ...req.query });
      // Only update if we can (some Express versions make query read-only)
      try {
        Object.keys(req.query).forEach((key) => {
          delete req.query[key];
        });
        Object.assign(req.query, sanitizedQuery);
      } catch (e) {
        // If we can't modify req.query, just continue
        console.warn("Could not sanitize query parameters (read-only)");
      }
    }

    // For URL parameters, create sanitized copy
    if (req.params && typeof req.params === "object") {
      const sanitizedParams = sanitizeObject({ ...req.params });
      try {
        Object.keys(req.params).forEach((key) => {
          delete req.params[key];
        });
        Object.assign(req.params, sanitizedParams);
      } catch (e) {
        // If we can't modify req.params, just continue
        console.warn("Could not sanitize URL parameters (read-only)");
      }
    }

    next();
  } catch (error) {
    console.error("Sanitization error:", error);
    next(); // Continue even if sanitization fails
  }
};

/**
 * Recursively sanitize an object
 */
const sanitizeObject = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj && typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === "string") {
    return xss(obj, {
      whiteList: {}, // No HTML tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ["script"],
    });
  }

  return obj;
};

/**
 * Request validation middleware
 */
const validateRequest = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /script\s*>/i,
    /javascript:/i,
    /vbscript:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn("Suspicious request detected", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        method: req.method,
        pattern: pattern.source,
        userId: req.user ? req.user.id : null,
      });

      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Request contains invalid characters",
        },
      });
    }
  }

  next();
};

/**
 * SQL injection protection middleware
 */
const preventSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\s+)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(;\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER))/i,
    /(\bCAST\s*\(.*AS\s+)/i,
    /(\bCONVERT\s*\()/i,
    /(\/\*.*\*\/)/g,
    /(--\s*[^\r\n]*)/g,
  ];

  // Only check body and query parameters, not the URL path
  const requestString = JSON.stringify({
    body: req.body || {},
    query: req.query || {},
  });

  for (const pattern of sqlPatterns) {
    if (pattern.test(requestString)) {
      logger.warn("Potential SQL injection attempt", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        method: req.method,
        userId: req.user ? req.user.id : null,
      });

      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Request contains potentially harmful content",
        },
      });
    }
  }

  next();
};

/**
 * File upload security middleware
 */
const secureFileUpload = (req, res, next) => {
  if (!req.files && !req.file) {
    return next();
  }

  const files = req.files || [req.file];
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  for (const file of files) {
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FILE_TYPE",
          message: "File type not allowed",
        },
      });
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "File size exceeds 10MB limit",
        },
      });
    }

    // Check for potentially malicious file names
    const maliciousPatterns = [
      /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|php|asp|aspx|jsp)$/i,
      /\.\./,
      /[<>:"|?*]/,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(file.originalname || file.name)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_FILENAME",
            message: "Filename contains invalid characters",
          },
        });
      }
    }
  }

  next();
};

/**
 * API key validation middleware
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: "API_KEY_REQUIRED",
        message: "API key is required",
      },
    });
  }

  // Validate API key format (example: should be 32 characters alphanumeric)
  if (!/^[a-zA-Z0-9]{32}$/.test(apiKey)) {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "Invalid API key format",
      },
    });
  }

  // In production, validate against database
  // For now, check against environment variable
  const validApiKey = process.env.API_KEY;
  if (validApiKey && apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "Invalid API key",
      },
    });
  }

  next();
};

/**
 * Request size limiter
 */
const limitRequestSize = (maxSize = "10mb") => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers["content-length"]);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        error: {
          code: "REQUEST_TOO_LARGE",
          message: `Request size exceeds ${maxSize} limit`,
        },
      });
    }

    next();
  };
};

/**
 * Parse size string to bytes
 */
const parseSize = (size) => {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || "b";

  return Math.floor(value * units[unit]);
};

/**
 * IP whitelist middleware
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn("IP not in whitelist", {
        ip: clientIP,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: "IP_NOT_ALLOWED",
          message: "Access denied from this IP address",
        },
      });
    }

    next();
  };
};

module.exports = {
  securityHeaders,
  sanitizeInput,
  validateRequest,
  preventSQLInjection,
  secureFileUpload,
  validateApiKey,
  limitRequestSize,
  ipWhitelist,
  sanitizeObject,
};
