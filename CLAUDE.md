# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CS Brain Tracker is an AI-powered learning tracker API designed to capture and analyze learning sessions from CS Brain vault (Obsidian-based knowledge management system). It provides RESTful endpoints for tracking learning captures with real-time analytics capabilities.

## Development Commands

```bash
# Install dependencies
npm install

# Development server with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Production server
npm start
```

## Architecture

The project follows a layered architecture pattern:

- **Routes** (`src/api/routes/`) - Express route handlers for HTTP endpoints
- **Services** (`src/services/`) - Business logic layer containing core functionality
- **Models** (`src/models/`) - Mongoose schemas for MongoDB data models
- **Config** (`src/config/`) - Configuration modules (database connections, etc.)
- **Utils** (`src/utils/`) - Shared utility functions

Entry points:
- `src/server.js` - Main server initialization
- `src/app.js` - Express application setup

## Database Configuration

MongoDB connection details:
- Local instance running on port 58745
- Connection string in `.env`: `MONGODB_URI=mongodb://localhost:58745/cs-brain-tracker`
- Database module includes retry logic with exponential backoff

## Key Implementation Notes

1. **Error Handling**: Sentry Pro is configured for error tracking. Ensure proper error handling in all routes and services.

2. **Security**: The app uses Helmet for security headers and CORS for cross-origin requests. Always validate input data.

3. **Testing**: Jest is configured for testing. Test files should be placed in the `tests/` directory.

4. **AI Development Approach**: Refer to AI-MODEL-GUIDE.md for specific guidance on using different AI models for various development tasks.

5. **Implementation Phases**: Follow IMPLEMENTATION-ROADMAP.md for the planned three-phase development approach.

## Environment Setup

Copy `.env.example` to `.env` and configure required variables:
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (default: 3000)
- Additional variables as needed for Sentry, API keys, etc.

## MongoDB Quick Setup

Use the `quick-start.sh` script to verify MongoDB connection:
```bash
chmod +x quick-start.sh
./quick-start.sh
```

This script tests the MongoDB connection and provides troubleshooting guidance if needed.