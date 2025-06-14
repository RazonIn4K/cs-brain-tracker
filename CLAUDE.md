# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CS Brain Tracker is an AI-powered learning tracker API designed to capture and analyze learning sessions from CS Brain vault (Obsidian-based knowledge management system). It provides RESTful endpoints for tracking learning captures with real-time analytics capabilities.

## Development Commands

```bash
# Install dependencies
npm install

# Development server with hot reload (nodemon)
npm run dev

# Run tests
npm test

# Lint code (ESLint)
npm run lint

# Format code (Prettier)
npm run format

# Production server
npm start
```

## Architecture

The project follows a layered architecture pattern:

- **Routes** (`src/api/routes/`) - Express route handlers for HTTP endpoints
  - `captures.js` - Full CRUD operations for learning captures with analytics
  - `auth.js` - Authentication endpoints (login, refresh, logout)
- **Models** (`src/models/`) - Mongoose schemas for MongoDB data models
  - `LearningCapture.js` - Comprehensive schema with spaced repetition, analytics, and Obsidian integration
  - `User.js` - User model with bcrypt password hashing
  - `refreshToken.js` - Refresh token tracking with device fingerprinting
- **Middleware** (`src/middleware/`) - Express middleware functions
  - `auth.js` - JWT verification with RS256, token binding, JWKS support
- **Config** (`src/config/`) - Configuration modules
  - `database.js` - MongoDB connection with exponential backoff retry logic
- **Services** (`src/services/`) - Business logic layer (to be implemented)
- **Utils** (`src/utils/`) - Shared utility functions (to be implemented)

Entry points:
- `src/server.js` - Server initialization with graceful shutdown handling
- `src/app.js` - Express application with comprehensive middleware stack

## Key Features Implemented

### Authentication System
- **JWT Tokens**: RS256 signing with 4096-bit keys
- **Token Management**: 15-minute access tokens, 30-day refresh tokens
- **Security**: Single-use refresh tokens, device fingerprinting, token binding
- **JWKS Support**: Remote public key verification with caching
- **Rate Limiting**: Strict limits on auth endpoints (5 req/15min)

### LearningCapture Model
- **Core fields**: type, content, timestamp, tags, cognitiveLoad, processed
- **Insights**: keyConcepts, connections, difficulty, summary, actionItems
- **Obsidian Integration**: noteId, notePath, vaultName, linkedNotes
- **Learning Metrics**: retentionScore, reviewCount, masteryLevel, spaced repetition
- **Analytics**: viewCount, helpfulCount, flagging system
- **Methods**: calculateNextReviewDate(), recordReview(), findRelated()

### API Endpoints

#### Authentication (`/api/v1/auth`)
- `POST /login` - Authenticate with email/password, returns JWT tokens
- `POST /refresh` - Refresh access token (single-use refresh tokens)
- `POST /logout` - Invalidate refresh token
- `GET /me` - Get current user info (protected route example)

#### Captures (`/api/v1/captures`) - All routes require authentication
- `GET /` - List with pagination, filtering by type/tags/date, text search
- `GET /stats` - Comprehensive analytics (by type, difficulty, daily velocity)
- `GET /search` - Advanced search with concept filtering
- `GET /:id` - Get single capture (increments view count)
- `POST /` - Create new capture
- `PUT /:id` - Update capture
- `DELETE /:id` - Soft delete
- `POST /bulk` - Bulk import from CS Brain exports
- `POST /:id/review` - Record review session
- `GET /:id/related` - Find related captures

### Security & Performance
- JWT authentication with RS256 signing (4096-bit keys)
- Single-use refresh tokens with rotation
- Device fingerprinting and token binding
- Helmet with CSP configuration
- CORS with configurable origins
- Rate limiting (100 req/15min production, 1000 dev)
- MongoDB injection prevention
- Response compression
- Request ID tracking
- Comprehensive error handling

## Database Configuration

MongoDB connection:
- Default: `mongodb://localhost:58745/cs_brain_tracker`
- Connection pooling (max 10)
- Exponential backoff retry (5 attempts)
- Graceful shutdown handling
- Connection event monitoring

## Environment Variables

Required in `.env`:
- `MONGODB_URI` - MongoDB connection string (default: localhost:58745)
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production)

Optional:
- `SENTRY_DSN` - Sentry error tracking
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `JWT_ISSUER` - JWT issuer claim (default: "https://cs-brain-tracker.local/")
- `JWT_AUDIENCE` - JWT audience claim (default: "cs-brain-tracker-api")
- `JWKS_URI` - Remote JWKS endpoint for public key verification

## Development Workflow

1. Run `npm run dev` to start development server with hot reload
2. Access health check at `http://localhost:3000/health`
3. API base URL: `http://localhost:3000/api/v1`
4. Use provided endpoints for CRUD operations on learning captures

## Testing & Quality

- Run `npm run lint` before committing to check for ESLint errors
- Run `npm run format` to auto-format code with Prettier
- Test endpoints with tools like Postman or curl
- Monitor MongoDB connection status via health endpoint

## MongoDB Quick Setup

Use the `quick-start.sh` script to verify MongoDB connection:
```bash
chmod +x quick-start.sh
./quick-start.sh
```

## Authentication Setup

1. Generate RSA key pair for JWT signing:
```bash
mkdir -p keys
openssl genrsa -out keys/private.pem 4096
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

2. Create a test user (via MongoDB shell or seed script):
```javascript
db.users.insertOne({
  email: "test@example.com",
  passwordHash: "$2a$10$...", // bcrypt hash of password
  name: "Test User"
})
```

## Current Implementation Status

✅ Completed:
- LearningCapture model with full schema
- User and RefreshToken models
- JWT authentication with RS256 signing
- Single-use refresh tokens with rotation
- Device fingerprinting and token binding
- Express app with security middleware
- Database connection with retry logic
- Complete CRUD API routes (protected)
- Analytics and search endpoints
- Authentication routes (login, refresh, logout)
- Server entry point with graceful shutdown
- Test suite for authentication flows

🔄 In Progress:
- Services layer implementation
- Utility functions
- Additional test coverage

📋 Upcoming (per IMPLEMENTATION-ROADMAP.md):
- Obsidian plugin integration
- Real-time sync capabilities
- Advanced AI-powered insights
- Frontend dashboard