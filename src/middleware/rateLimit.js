const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const redisManager = require("../config/redis");
const logger = require("../config/logger");
const CONSTANTS = require("../config/constants");

/**
 * Create a rate limiter with Redis store
 * @param {Object} options - Rate limiting options
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = CONSTANTS.RATE_LIMITS.GLOBAL.WINDOW_MS,
    max = CONSTANTS.RATE_LIMITS.GLOBAL.MAX_REQUESTS,
    message = "Too many requests, please try again later",
    standardHeaders = true,
    legacyHeaders = false,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = undefined,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: CONSTANTS.ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message,
      },
    },
    standardHeaders,
    legacyHeaders,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator:
      keyGenerator ||
      ((req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user ? `user_${req.user.id}` : req.ip;
      }),
    // No custom store - use default memory store
  });
};

/**
 * Global rate limiter
 */
const globalRateLimit = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMITS.GLOBAL.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.GLOBAL.MAX_REQUESTS,
  message: "Too many requests from this IP, please try again later",
});

/**
 * Authentication rate limiter
 */
const authRateLimit = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMITS.AUTH.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.AUTH.MAX_REQUESTS,
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Use email/phone if provided, otherwise IP
    const identifier = req.body.email || req.body.phone || req.ip;
    return `auth_${identifier}`;
  },
});

/**
 * API rate limiter (general use)
 */
const apiRateLimit = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMITS.GLOBAL.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.GLOBAL.MAX_REQUESTS,
  message: "Too many API requests, please try again later",
});

/**
 * Strict rate limiter (for sensitive operations)
 */
const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 requests per 15 minutes
  message: "Too many requests for this operation, please try again later",
});

/**
 * Download rate limiter
 */
const downloadRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 downloads per 5 minutes
  message: "Too many download requests, please try again later",
});

/**
 * File upload rate limiter
 */
const uploadRateLimit = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMITS.UPLOAD.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.UPLOAD.MAX_REQUESTS,
  message: "Too many file uploads, please try again later",
});

/**
 * Search rate limiter
 */
const searchRateLimit = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMITS.SEARCH.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.SEARCH.MAX_REQUESTS,
  message: "Too many search requests, please try again later",
});

/**
 * Slow down middleware for gradual response delays
 */
const createSlowDown = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    delayAfter = 100, // Allow 100 requests per windowMs without delay
    delayMs = 500, // Add 500ms delay per request after delayAfter
    maxDelayMs = 20000, // Maximum delay of 20 seconds
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
  } = options;

  return slowDown({
    windowMs,
    delayAfter,
    delayMs: () => delayMs,
    maxDelayMs,
    skipFailedRequests,
    skipSuccessfulRequests,
    keyGenerator: (req) => {
      return req.user ? `user_${req.user.id}` : req.ip;
    },
  });
};

/**
 * API slow down middleware
 */
const apiSlowDown = createSlowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500,
  maxDelayMs: 20000,
});

/**
 * Authentication slow down middleware
 */
const authSlowDown = createSlowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: 1000,
  maxDelayMs: 30000,
  skipSuccessfulRequests: true,
});

/**
 * Custom rate limiter for specific endpoints
 * @param {Object} config - Rate limiting configuration
 */
const customRateLimit = (config) => {
  return createRateLimiter(config);
};

/**
 * Bypass rate limiting for certain conditions
 */
const bypassRateLimit = (req, res, next) => {
  // Skip rate limiting for admin users or specific conditions
  if (req.user && req.user.type === "admin") {
    return next();
  }

  // Skip for health check endpoints
  if (req.path === "/health" || req.path === "/status") {
    return next();
  }

  // Continue with normal rate limiting
  next();
};

/**
 * Rate limit based on user type
 */
const userTypeRateLimit = (req, res, next) => {
  if (!req.user) {
    // Anonymous users get stricter limits
    return createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: "Too many requests from anonymous user, please login",
    })(req, res, next);
  }

  if (req.user.type === "ca") {
    // CAs get higher limits
    return createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: "Too many requests, please try again later",
    })(req, res, next);
  }

  // Regular users
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later",
  })(req, res, next);
};

/**
 * Dynamic rate limiting based on endpoint sensitivity
 */
const dynamicRateLimit = (req, res, next) => {
  const path = req.path.toLowerCase();

  // Payment endpoints - very strict
  if (path.includes("/payment")) {
    return createRateLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5,
      message: "Too many payment requests, please try again later",
    })(req, res, next);
  }

  // Document upload endpoints - moderate
  if (path.includes("/document") && req.method === "POST") {
    return uploadRateLimit(req, res, next);
  }

  // Search endpoints - moderate
  if (path.includes("/search") || path.includes("/ca")) {
    return searchRateLimit(req, res, next);
  }

  // Authentication endpoints - strict
  if (path.includes("/auth")) {
    return authRateLimit(req, res, next);
  }

  // Default rate limiting
  return globalRateLimit(req, res, next);
};

/**
 * Log rate limit violations
 */
const logRateLimitViolation = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    if (res.statusCode === 429) {
      logger.warn("Rate limit exceeded", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        method: req.method,
        userId: req.user ? req.user.id : null,
        timestamp: new Date().toISOString(),
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

module.exports = {
  globalRateLimit,
  authRateLimit,
  apiRateLimit,
  strictRateLimit,
  downloadRateLimit,
  uploadRateLimit,
  searchRateLimit,
  apiSlowDown,
  authSlowDown,
  customRateLimit,
  bypassRateLimit,
  userTypeRateLimit,
  dynamicRateLimit,
  logRateLimitViolation,
  createRateLimiter,
  createSlowDown,
};
