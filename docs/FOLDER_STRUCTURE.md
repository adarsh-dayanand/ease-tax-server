# EaseTax Backend - Folder Structure

## Overview
This is a **modular monolith** architecture designed for easy migration to microservices. Each service boundary is clearly defined while keeping everything in a single deployable unit for MVP simplicity.

## Folder Structure

```
backend/
├── src/                           # Main source code
│   ├── index.js                  # Application entry point
│   ├── app.js                    # Express app configuration
│   ├── server.js                 # Server setup and WebSocket initialization
│   │
│   ├── config/                   # Configuration files
│   │   ├── database.js           # Database configuration
│   │   ├── redis.js              # Redis configuration
│   │   ├── firebase.js           # Firebase Auth configuration
│   │   ├── storage.js            # File storage configuration
│   │   ├── constants.js          # Application constants
│   │   └── logger.js             # Logging configuration
│   │
│   ├── controllers/              # HTTP request handlers (thin layer)
│   │   ├── authController.js     # Authentication endpoints
│   │   ├── userController.js     # User management endpoints
│   │   ├── caController.js       # CA management endpoints
│   │   ├── consultationController.js # Consultation/ServiceRequest endpoints
│   │   ├── documentController.js # Document management endpoints
│   │   ├── paymentController.js  # Payment processing endpoints
│   │   ├── chatController.js     # Chat/messaging endpoints
│   │   ├── vcController.js       # Video call scheduling endpoints
│   │   └── notificationController.js # Notification endpoints
│   │
│   ├── services/                 # Business logic layer (service boundaries)
│   │   ├── authService.js        # Authentication & JWT logic
│   │   ├── userService.js        # User business logic
│   │   ├── caService.js          # CA business logic
│   │   ├── consultationService.js # Consultation workflow logic
│   │   ├── documentService.js    # Document processing logic
│   │   ├── paymentService.js     # Payment & escrow logic
│   │   ├── chatService.js        # Chat/messaging logic
│   │   ├── vcService.js          # Video call integration logic
│   │   ├── notificationService.js # Notification logic
│   │   └── searchService.js      # Search and filtering logic
│   │
│   ├── routes/                   # API route definitions
│   │   ├── index.js              # Main router
│   │   ├── auth.js               # Authentication routes
│   │   ├── users.js              # User routes
│   │   ├── ca.js                 # CA routes
│   │   ├── consultations.js      # Consultation routes
│   │   ├── documents.js          # Document routes
│   │   ├── payments.js           # Payment routes
│   │   ├── chat.js               # Chat routes
│   │   ├── vc.js                 # Video call routes
│   │   └── notifications.js      # Notification routes
│   │
│   ├── middleware/               # Express middleware
│   │   ├── auth.js               # Authentication middleware
│   │   ├── validation.js         # Request validation middleware
│   │   ├── rateLimit.js          # Rate limiting middleware
│   │   ├── errorHandler.js       # Global error handler
│   │   ├── cors.js               # CORS configuration
│   │   ├── security.js           # Security headers (helmet, etc.)
│   │   └── upload.js             # File upload middleware
│   │
│   ├── validators/               # Request validation schemas
│   │   ├── authValidation.js     # Auth request validations
│   │   ├── userValidation.js     # User request validations
│   │   ├── caValidation.js       # CA request validations
│   │   ├── consultationValidation.js # Consultation validations
│   │   ├── documentValidation.js # Document validations
│   │   └── paymentValidation.js  # Payment validations
│   │
│   ├── helpers/                  # Utility functions and helpers
│   │   ├── responseFormatter.js  # Standardized API responses
│   │   ├── encryption.js         # Encryption/decryption utilities
│   │   ├── fileUpload.js         # File upload utilities
│   │   ├── emailService.js       # Email sending utilities
│   │   ├── smsService.js         # SMS sending utilities
│   │   ├── dateUtils.js          # Date manipulation utilities
│   │   ├── pagination.js         # Pagination helpers
│   │   └── cacheManager.js       # Redis caching utilities
│   │
│   ├── jobs/                     # Background job processors
│   │   ├── emailQueue.js         # Email notification jobs
│   │   ├── smsQueue.js           # SMS notification jobs
│   │   ├── paymentQueue.js       # Payment processing jobs
│   │   ├── deadlineQueue.js      # Deadline reminder jobs
│   │   └── escalationQueue.js    # Escalation handling jobs
│   │
│   ├── websocket/                # WebSocket related code
│   │   ├── socketHandler.js      # Main WebSocket handler
│   │   ├── chatHandler.js        # Chat WebSocket events
│   │   ├── notificationHandler.js # Notification WebSocket events
│   │   └── authSocket.js         # WebSocket authentication
│   │
│   └── utils/                    # General utilities
│       ├── logger.js             # Logging utility
│       ├── database.js           # Database connection utilities
│       └── redis.js              # Redis connection utilities
│
├── models/                       # Sequelize models (existing)
│   ├── index.js                  # Model aggregator
│   ├── user.js                   # User model
│   ├── ca.js                     # CA model
│   ├── caSpecialization.js       # CA specialization model
│   ├── caAvailability.js         # CA availability model
│   ├── review.js                 # Review model
│   ├── serviceRequest.js         # Service request model (to be created)
│   ├── document.js               # Document model (to be created)
│   ├── payment.js                # Payment model (to be created)
│   ├── meeting.js                # Meeting model (to be created)
│   ├── message.js                # Chat message model (to be created)
│   └── notification.js           # Notification model (to be created)
│
├── migrations/                   # Database migrations (existing)
├── config/                       # Sequelize configuration (existing)
├── logs/                         # Application logs
├── uploads/                      # Temporary file uploads
├── tests/                        # Test files
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
│
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies and scripts
├── Dockerfile                    # Docker configuration
├── docker-compose.yml            # Docker compose for local development
└── README.md                     # Project documentation
```

## Service Boundaries (Future Microservices)

### 1. Auth Service (`src/services/authService.js`)
- User authentication and authorization
- JWT token management
- Firebase Auth integration
- Session management

### 2. User Service (`src/services/userService.js`)
- User profile management
- KYC verification
- User dashboard data

### 3. CA Service (`src/services/caService.js`)
- CA profile management
- CA search and filtering
- CA availability management
- CA dashboard data

### 4. Consultation Service (`src/services/consultationService.js`)
- Service request lifecycle
- CA assignment and queueing
- Consultation status management
- Workflow orchestration

### 5. Document Service (`src/services/documentService.js`)
- File upload and storage
- Document encryption/decryption
- Document sharing and access control

### 6. Payment Service (`src/services/paymentService.js`)
- Payment processing
- Escrow management
- Commission calculation
- Refund handling

### 7. Communication Service
- **Chat Service** (`src/services/chatService.js`): Real-time messaging
- **Notification Service** (`src/services/notificationService.js`): Email, SMS, in-app notifications

### 8. Integration Service
- **VC Service** (`src/services/vcService.js`): Video call scheduling (Google Meet/Zoom)

## Key Design Principles

1. **Service Boundaries**: Each service is self-contained with clear interfaces
2. **Dependency Injection**: Services don't directly depend on each other
3. **Event-Driven**: Services communicate through events (WebSocket/Redis pub-sub)
4. **Database Per Service**: Each service owns its data models
5. **API Gateway Pattern**: Controllers act as thin API gateway layer
6. **CQRS Ready**: Separate read and write operations where beneficial

## Migration to Microservices

When ready to split into microservices:
1. Each service folder becomes a separate service
2. Add API clients for inter-service communication
3. Extract shared models into service-specific databases
4. Add service discovery and load balancing
5. Implement distributed tracing and monitoring

## Technology Stack

- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis
- **Authentication**: Firebase Auth + JWT
- **File Storage**: Google Drive API (MVP) → AWS S3 (Production)
- **Real-time**: WebSockets
- **Queue**: Redis-based job queues
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI