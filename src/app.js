const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const Sentry = require('@sentry/node');
const fingerprint = require('express-fingerprint');
const { checkJwt, enforceTokenBinding } = require('./middleware/auth');
// ProfilingIntegration is optional and may not be available in all versions
let ProfilingIntegration;
try {
  ProfilingIntegration = require('@sentry/profiling-node').ProfilingIntegration;
} catch (e) {
  console.log('Sentry profiling not available, continuing without it');
}

const connectDB = require('./config/database');

const app = express();

// Initialize Sentry for error tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      ...(ProfilingIntegration ? [new ProfilingIntegration()] : []),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
  });

  // Sentry request handler must be first middleware
  app.use(Sentry.Handlers.requestHandler());
  
  // Sentry tracing handler
  app.use(Sentry.Handlers.tracingHandler());
}

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:5173'];
    
    // Allow requests with no origin (e.g., mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

app.use('/api/', limiter);
app.use('/api/auth/', strictLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB injection prevention
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Blocked MongoDB injection attempt in ${key}`);
  }
}));

// Response compression
app.use(compression());

// Device fingerprinting (must come before auth middleware)
app.use(fingerprint());

// JWT auth & token binding applied globally to API routes (excluded paths configured in middleware)
app.use(checkJwt);
app.use(enforceTokenBinding);

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Custom production logging format
  app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms'));
}

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbState = require('mongoose').connection.readyState;
    const isDbConnected = dbState === 1;
    
    const healthStatus = {
      status: isDbConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: isDbConnected ? 'connected' : 'disconnected',
          type: 'MongoDB'
        }
      }
    };
    
    res.status(isDbConnected ? 200 : 503).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API version info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'CS Brain Tracker API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api/v1/docs'
  });
});

// Mount API routes
app.use('/api/v1/captures', require('./api/routes/captures'));
app.use('/api/v1/auth', require('./api/routes/auth'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
});

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    requestId: req.id,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        type: 'ValidationError',
        message: 'Invalid input data',
        details: isDevelopment ? err.errors : undefined
      }
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: {
        type: 'InvalidID',
        message: 'Invalid resource ID format'
      }
    });
  }
  
  if (err.code === 11000) {
    return res.status(409).json({
      error: {
        type: 'DuplicateKey',
        message: 'Resource already exists',
        field: isDevelopment ? Object.keys(err.keyPattern)[0] : undefined
      }
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: statusCode === 500 ? 'Internal server error' : err.message,
      requestId: req.id,
      ...(isDevelopment && {
        stack: err.stack,
        details: err
      })
    }
  });
});

// Graceful shutdown handling
let server;

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  
  // Close database connections
  try {
    await require('mongoose').connection.close();
    console.log('Database connections closed');
  } catch (err) {
    console.error('Error closing database connections:', err);
  }
  
  // Close Sentry
  if (process.env.SENTRY_DSN) {
    await Sentry.close(2000);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Store server reference for graceful shutdown
app.set('server', (srv) => { server = srv; });

module.exports = app;

