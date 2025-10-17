# Ease Tax Backend API v1

A Node.js backend application built with Express, PostgreSQL, Sequelize ORM, and Redis caching.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Redis (v6 or higher)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ease-tax
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DIALECT=postgres
PORT=3000
REDIS_URL=redis://127.0.0.1:6379
NODE_ENV=development
```

3. Create the PostgreSQL database:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE ease_tax_dev;"

# Or using createdb (if PostgreSQL CLI tools are installed)
createdb ease_tax_dev
```

4. Run database migrations:

```bash
npm run migrate
```

## Database Schema

### Users Table

- User authentication via Phone + OTP or Google Auth (Firebase)
- Fields: name, email, phone, pan, gstin, phoneVerified, profileImage, googleUid

### CAs Table

- Chartered Accountant profiles (CAs can also login with Phone/Google Auth)
- Fields: name, email, phone, location, image, verified, completedFilings, phoneVerified, googleUid
- **Note**: Rating and reviewCount are computed dynamically from Reviews table (not stored)

### CASpecializations Table

- Maps CAs to their specializations with experience and fees per specialization
- Fields: caId, specialization, experience, fees, isActive
- **Why?** A CA can have multiple specializations with different expertise and pricing

### CAAvailability Table

- Stores CA availability schedules (day of week and time slots)
- Fields: caId, dayOfWeek, startTime, endTime, isActive
- **Why?** CAs have multiple time slots across different days

### Reviews Table

- User reviews and ratings for CAs
- Fields: caId, userId, rating (1-5), review, isVerified
- **Source of truth** for CA ratings and review counts

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## API Endpoints

(To be implemented)

## Authentication

The application supports two authentication methods:

1. **Phone + OTP**: Users can register/login using their phone number with OTP verification
2. **Google Auth**: Users can authenticate using Firebase Google authentication

## Project Structure

```
backend/
├── config/          # Configuration files
├── migrations/      # Database migrations
├── models/          # Sequelize models
│   ├── user.js
│   ├── ca.js
│   ├── caSpecialization.js
│   ├── caAvailability.js
│   ├── review.js
│   └── index.js
├── seeders/         # Database seeders
├── src/             # Application source code
│   ├── index.js     # Application entry point
│   ├── redis.js     # Redis client setup
│   └── utils/
│       └── caRatingHelper.js  # Helper to compute CA ratings
├── docs/            # Documentation
│   └── DATABASE_DESIGN.md     # Detailed database design docs
├── requirements/    # Requirements and type definitions
└── package.json
```

## Database Design

For detailed information about the database design principles and why certain decisions were made, see [DATABASE_DESIGN.md](./docs/DATABASE_DESIGN.md).

Key points:

- **Normalized design** - No data duplication
- **Computed ratings** - Ratings calculated from Reviews table, not stored
- **Flexible relationships** - CAs can have multiple specializations and availability slots
- **Data integrity** - Single source of truth for all data

## Technologies

- **Express.js**: Web framework
- **Sequelize**: ORM for PostgreSQL
- **PostgreSQL**: Relational database
- **Redis**: Caching layer
- **dotenv**: Environment variable management
