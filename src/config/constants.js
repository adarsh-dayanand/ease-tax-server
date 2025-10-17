// Application-wide constants
const CONSTANTS = {
  // User roles
  USER_ROLES: {
    USER: 'user',
    CA: 'ca',
    ADMIN: 'admin'
  },

  // Service request statuses
  SERVICE_REQUEST_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ESCALATED: 'escalated'
  },

  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled'
  },

  // Payment types
  PAYMENT_TYPE: {
    BOOKING_FEE: 'booking_fee',
    SERVICE_FEE: 'service_fee',
    CANCELLATION_FEE: 'cancellation_fee',
    REFUND: 'refund'
  },

  // Document types
  DOCUMENT_TYPE: {
    FORM16: 'form16',
    BANK_STATEMENT: 'bank_statement',
    PAN_CARD: 'pan_card',
    AADHAR_CARD: 'aadhar_card',
    ITR_FORM: 'itr_form',
    ITR_V: 'itr_v',
    OTHER: 'other'
  },

  // Document status
  DOCUMENT_STATUS: {
    UPLOADED: 'uploaded',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
    PROCESSING: 'processing'
  },

  // Meeting types
  MEETING_TYPE: {
    VIDEO: 'video',
    PHONE: 'phone',
    CHAT: 'chat'
  },

  // Meeting status
  MEETING_STATUS: {
    SCHEDULED: 'scheduled',
    RESCHEDULED: 'rescheduled',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    NO_SHOW: 'no_show'
  },

  // Notification types
  NOTIFICATION_TYPE: {
    EMAIL: 'email',
    SMS: 'sms',
    IN_APP: 'in_app',
    PUSH: 'push'
  },

  // Notification priority
  NOTIFICATION_PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },

  // Message types for chat
  MESSAGE_TYPE: {
    TEXT: 'text',
    FILE: 'file',
    IMAGE: 'image',
    SYSTEM: 'system'
  },

  // CA specializations
  CA_SPECIALIZATION: {
    INCOME_TAX: 'income_tax',
    GST: 'gst',
    COMPANY_LAW: 'company_law',
    AUDIT: 'audit',
    ACCOUNTING: 'accounting',
    FINANCIAL_PLANNING: 'financial_planning',
    TAX_PLANNING: 'tax_planning'
  },

  // File upload constraints
  FILE_UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB in bytes
    ALLOWED_TYPES: {
      IMAGES: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      DOCUMENTS: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
      ALL: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx']
    },
    MIME_TYPES: {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
    }
  },

  // Business rules
  BUSINESS_RULES: {
    BOOKING_FEE: 999, // Rs. 999
    COMMISSION_PERCENTAGE: 8, // 8%
    MINIMUM_SERVICE_FEE: 4999, // Rs. 6000
    CANCELLATION_FEE: 999, // Rs. 999
    CA_RESPONSE_TIMEOUT_HOURS: 24, // 24 hours for CA to respond
    PAYMENT_TIMEOUT_MINUTES: 15, // 15 minutes for payment completion
    FILE_RETENTION_DAYS: 1095, // 3 years
    SESSION_TIMEOUT_HOURS: 24, // 24 hours
    MAX_CONSULTATION_RESCHEDULE: 2, // Maximum reschedule attempts
    CA_SEARCH_LIMIT: 50, // Maximum CAs to return in search
    MESSAGE_HISTORY_LIMIT: 100 // Maximum messages to load initially
  },

  // Rate limiting
  RATE_LIMITS: {
    GLOBAL: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100
    },
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 5 // 5 login attempts per 15 minutes
    },
    UPLOAD: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 10 // 10 uploads per minute
    },
    SEARCH: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 30 // 30 searches per minute
    }
  },

  // Cache TTL (Time To Live) in seconds
  CACHE_TTL: {
    USER_PROFILE: 30 * 60, // 30 minutes
    CA_PROFILE: 30 * 60, // 30 minutes
    CA_LIST: 10 * 60, // 10 minutes
    SEARCH_RESULTS: 5 * 60, // 5 minutes
    SESSION: 24 * 60 * 60, // 24 hours
    OTP: 10 * 60, // 10 minutes
    TEMP_DATA: 60 * 60 // 1 hour
  },

  // WebSocket events
  WEBSOCKET_EVENTS: {
    // Connection events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    
    // Authentication events
    AUTHENTICATE: 'authenticate',
    AUTHENTICATION_SUCCESS: 'authentication_success',
    AUTHENTICATION_FAILED: 'authentication_failed',
    
    // Chat events
    JOIN_CONSULTATION: 'join_consultation',
    LEAVE_CONSULTATION: 'leave_consultation',
    NEW_MESSAGE: 'new_message',
    MESSAGE_SENT: 'message_sent',
    MESSAGE_DELIVERED: 'message_delivered',
    MESSAGE_READ: 'message_read',
    TYPING_START: 'typing_start',
    TYPING_STOP: 'typing_stop',
    
    // Notification events
    NEW_NOTIFICATION: 'new_notification',
    NOTIFICATION_READ: 'notification_read',
    
    // Consultation events
    CONSULTATION_STATUS_CHANGED: 'consultation_status_changed',
    CONSULTATION_ACCEPTED: 'consultation_accepted',
    CONSULTATION_REJECTED: 'consultation_rejected',
    CONSULTATION_CANCELLED: 'consultation_cancelled',
    
    // Payment events
    PAYMENT_STATUS_CHANGED: 'payment_status_changed',
    
    // Error events
    ERROR: 'error'
  },

  // Email templates
  EMAIL_TEMPLATES: {
    WELCOME_USER: 'welcome_user',
    WELCOME_CA: 'welcome_ca',
    CONSULTATION_REQUESTED: 'consultation_requested',
    CONSULTATION_ACCEPTED: 'consultation_accepted',
    CONSULTATION_REJECTED: 'consultation_rejected',
    CONSULTATION_CANCELLED: 'consultation_cancelled',
    PAYMENT_SUCCESSFUL: 'payment_successful',
    PAYMENT_FAILED: 'payment_failed',
    REFUND_PROCESSED: 'refund_processed',
    DEADLINE_REMINDER: 'deadline_reminder',
    PASSWORD_RESET: 'password_reset',
    EMAIL_VERIFICATION: 'email_verification'
  },

  // SMS templates
  SMS_TEMPLATES: {
    OTP_VERIFICATION: 'otp_verification',
    CONSULTATION_ACCEPTED: 'consultation_accepted',
    CONSULTATION_REJECTED: 'consultation_rejected',
    PAYMENT_SUCCESSFUL: 'payment_successful',
    DEADLINE_REMINDER: 'deadline_reminder'
  },

  // External service providers
  VIDEO_CALL_PROVIDERS: {
    GOOGLE_MEET: 'google_meet',
    ZOOM: 'zoom',
    MICROSOFT_TEAMS: 'microsoft_teams'
  },

  // Error codes
  ERROR_CODES: {
    // Authentication errors
    AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
    AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
    
    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
    INVALID_FORMAT: 'INVALID_FORMAT',
    
    // Business logic errors
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    CA_NOT_FOUND: 'CA_NOT_FOUND',
    CONSULTATION_NOT_FOUND: 'CONSULTATION_NOT_FOUND',
    DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
    
    // File errors
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
    FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
    
    // Rate limiting errors
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    
    // Server errors
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
  },

  // Success messages
  SUCCESS_MESSAGES: {
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    CA_CREATED: 'CA profile created successfully',
    CA_UPDATED: 'CA profile updated successfully',
    CONSULTATION_CREATED: 'Consultation requested successfully',
    CONSULTATION_UPDATED: 'Consultation updated successfully',
    DOCUMENT_UPLOADED: 'Document uploaded successfully',
    PAYMENT_SUCCESSFUL: 'Payment completed successfully',
    MESSAGE_SENT: 'Message sent successfully',
    EMAIL_SENT: 'Email sent successfully',
    SMS_SENT: 'SMS sent successfully'
  }
};

module.exports = CONSTANTS;