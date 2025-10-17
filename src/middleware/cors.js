const cors = require('cors');
const logger = require('../config/logger');

/**
 * CORS configuration based on environment
 */
const getCorsOptions = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const websocketOrigin = process.env.WEBSOCKET_CORS_ORIGIN || frontendUrl;

  // Development - Allow all origins
  if (isDevelopment) {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-New-Token'
      ],
      exposedHeaders: ['X-New-Token'],
      optionsSuccessStatus: 200,
      preflightContinue: false
    };
  }

  // Production - Specific origins only
  const allowedOrigins = [
    frontendUrl,
    websocketOrigin,
    // Add production domains here
    'https://easetax.com',
    'https://www.easetax.com',
    'https://app.easetax.com'
  ].filter(Boolean);

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-New-Token'
    ],
    exposedHeaders: ['X-New-Token'],
    optionsSuccessStatus: 200,
    preflightContinue: false
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

  if (typeof corsOptions.origin === 'function') {
    corsOptions.origin(origin, callback);
  } else if (Array.isArray(corsOptions.origin)) {
    if (corsOptions.origin.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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
  methods: ['POST', 'OPTIONS'],
  maxAge: 86400 // 24 hours preflight cache
});

/**
 * CORS middleware for webhooks (more restrictive)
 */
const webhookCors = cors({
  origin: [
    // Payment gateway IPs/domains
    'https://api.razorpay.com',
    'https://api.phonepe.com',
    'https://api.cashfree.com',
    // Add other webhook sources
  ],
  methods: ['POST'],
  credentials: false,
  optionsSuccessStatus: 200
});

/**
 * Dynamic CORS based on route
 */
const dynamicCors = (req, res, next) => {
  const path = req.path.toLowerCase();
  
  // Webhook routes
  if (path.includes('/webhook')) {
    return webhookCors(req, res, next);
  }
  
  // Upload routes
  if (path.includes('/upload') || path.includes('/document')) {
    return uploadCors(req, res, next);
  }
  
  // Default API CORS
  return apiCors(req, res, next);
};

/**
 * Custom CORS error handler
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    logger.warn('CORS error', {
      origin: req.get('Origin'),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_NOT_ALLOWED',
        message: 'Cross-origin request not allowed'
      }
    });
  }
  
  next(err);
};

/**
 * Pre-flight OPTIONS handler
 */
const handlePreflightOptions = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Set additional headers for preflight
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.header('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    
    return res.status(200).end();
  }
  
  next();
};

/**
 * Security headers for CORS
 */
const corsSecurityHeaders = (req, res, next) => {
  // Prevent CSRF attacks
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Only allow HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
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
  getCorsOptions
};