# CS Brain Tracker

🚀 **AI-powered learning tracker** with JWT authentication, OAuth integration, MongoDB, and viral clipper functionality.

## 🌟 Features

- **🔐 Comprehensive Authentication**
  - JWT-based authentication with refresh tokens
  - OAuth providers: Google, GitHub, Discord
  - Personal API for secure data access
  - Rate limiting and security middleware

- **📊 Learning Management**
  - Capture and track learning sessions
  - MongoDB integration with analytics
  - Export/import functionality for data portability
  - CLI tools for efficient data management

- **🔧 Developer Experience**
  - Built with GitHub Copilot Pro
  - Comprehensive test coverage
  - Error monitoring with Sentry
  - Production-ready security features

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (local or Atlas)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/RazonIn4K/cs-brain-tracker.git
cd cs-brain-tracker

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/cs-brain-tracker

# JWT Secrets
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Personal API
PERSONAL_API_SECRET=your_personal_api_secret

# Error Tracking (Optional)
SENTRY_DSN=your_sentry_dsn
```

### Database Setup

```bash
# Seed the database with initial data
npm run seed

# For production seeding
npm run seed:prod
```

### Running the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test
```

## 📁 Project Structure

```
src/
├── api/
│   └── routes/          # API endpoints
│       ├── auth.js      # Authentication routes
│       ├── captures.js  # Learning capture routes
│       ├── personal.js  # Personal API routes
│       └── users.js     # User management
├── config/
│   └── database.js      # MongoDB configuration
├── middleware/
│   ├── auth.js          # JWT middleware
│   ├── personalAuth.js  # Personal API auth
│   └── rateLimiter.js   # Rate limiting
├── models/
│   ├── User.js          # User schema
│   ├── LearningCapture.js # Learning data schema
│   └── refreshToken.js  # Token management
├── services/
│   ├── analytics.js     # Analytics service
│   ├── oauth.service.js # OAuth handling
│   └── personalCapture.js # Personal data service
└── utils/               # Utility functions

cli/                     # Command-line tools
├── capture.js          # Quick capture CLI
└── export-import.js    # Data management CLI

tests/                  # Test suites
├── auth.test.js        # Authentication tests
├── auth.integration.js # Integration tests
└── rateLimiter.test.js # Rate limiting tests
```

## 🔧 CLI Tools

The project includes powerful CLI tools for efficient workflow:

### Quick Capture

```bash
# Install globally for easy access
npm install -g .

# Capture learning notes
capture "Just learned about JWT refresh tokens"
capture --type "concept" "OAuth 2.0 flow explanation"

# Sync data between environments
cs-brain-sync export --format json
cs-brain-sync import --file backup.json
```

## 🔐 Authentication Flow

### JWT Authentication
- Access tokens (15-minute expiry)
- Refresh tokens (7-day expiry)
- Automatic token rotation
- Secure httpOnly cookies

### OAuth Integration
- Google OAuth 2.0
- GitHub OAuth
- Discord OAuth
- Automatic user creation/linking

### Personal API
- Dedicated authentication for CLI tools
- Rate-limited endpoints
- Secure data access

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/github` - GitHub OAuth
- `GET /api/auth/discord` - Discord OAuth

### Learning Captures
- `GET /api/captures` - List captures
- `POST /api/captures` - Create capture
- `PUT /api/captures/:id` - Update capture
- `DELETE /api/captures/:id` - Delete capture

### Personal API
- `POST /api/personal/capture` - Quick capture
- `GET /api/personal/export` - Export data
- `POST /api/personal/import` - Import data

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `DELETE /api/users/account` - Delete account

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test auth.test.js

# Run integration tests
npm test auth.integration.test.js
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Docker

```bash
# Build image
docker build -t cs-brain-tracker .

# Run container
docker run -p 3000:3000 --env-file .env cs-brain-tracker
```

## 🔒 Security Features

- **Helmet.js** - Security headers
- **Rate limiting** - API protection
- **Input validation** - XSS/injection prevention
- **CORS** - Cross-origin security
- **MongoDB sanitization** - NoSQL injection prevention
- **JWT security** - Secure token handling

## 📊 Monitoring

- **Sentry** - Error tracking and performance monitoring
- **Morgan** - HTTP request logging
- **Custom analytics** - Learning pattern tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with **GitHub Copilot Pro** for AI-enhanced development
- Integrated with **CS Brain** learning methodology
- Powered by modern Node.js ecosystem

---

**🚀 Ready to track your learning journey?** Star this repo and start capturing your knowledge!

![GitHub stars](https://img.shields.io/github/stars/RazonIn4K/cs-brain-tracker)
![GitHub forks](https://img.shields.io/github/forks/RazonIn4K/cs-brain-tracker)
![GitHub issues](https://img.shields.io/github/issues/RazonIn4K/cs-brain-tracker)