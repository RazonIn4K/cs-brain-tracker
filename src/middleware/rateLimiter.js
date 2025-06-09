const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// Create Redis client if available
let redis;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('Redis connection failed, falling back to memory store');
        return null;
      }
      return Math.min(times * 50, 2000);
    }
  });
  
  redis.on('error', (err) => {
    console.error('Redis error:', err.message);
  });
} catch (err) {
  console.warn('Redis not available, using memory store for rate limiting');
}

/**
 * Creates a rate limiter with user-aware key generation
 * Authenticated users get their own limits, unauthenticated share IP-based limits
 */
function createRateLimiter(options = {}) {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Default limit
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID for authenticated users, IP for anonymous
      return req.user?.sub || req.ip;
    },
    handler: (req, res) => {
      const retryAfter = req.rateLimit.resetTime 
        ? new Date(req.rateLimit.resetTime).toISOString()
        : null;
        
      res.status(429).json({
        error: {
          message: 'Too many requests, please try again later',
          retryAfter,
          limit: req.rateLimit.limit,
          remaining: req.rateLimit.remaining,
          reset: retryAfter
        }
      });
    }
  };
  
  const config = { ...defaults, ...options };
  
  // Use Redis store if available
  if (redis && redis.status === 'ready') {
    config.store = new RedisStore({
      client: redis,
      prefix: 'rl:'
    });
  }
  
  return rateLimit(config);
}

/**
 * Rate limiter for general API endpoints
 * - Anonymous: 100 requests per 15 minutes
 * - Authenticated: 1000 requests per 15 minutes
 */
const apiLimiter = createRateLimiter({
  max: (req) => {
    // Authenticated users get 10x the limit
    return req.user?.sub ? 1000 : 100;
  },
  skip: (req) => {
    // Skip rate limiting for premium users
    return req.user?.subscription?.plan === 'pro' || 
           req.user?.subscription?.plan === 'team';
  }
});

/**
 * Strict rate limiter for auth endpoints
 * - 5 requests per 15 minutes per IP (not per user)
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip // Always use IP for auth endpoints
});

/**
 * Rate limiter for resource-intensive operations
 * - 10 requests per hour
 */
const heavyLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Resource-intensive operation limit reached. Please try again later.'
});

/**
 * Dynamic rate limiter based on user plan
 */
function createPlanBasedLimiter(baseLimit = 100) {
  return createRateLimiter({
    max: (req) => {
      if (!req.user) return baseLimit;
      
      const plan = req.user.subscription?.plan || 'free';
      const multipliers = {
        free: 1,
        pro: 5,
        team: 10
      };
      
      return baseLimit * (multipliers[plan] || 1);
    }
  });
}

/**
 * Middleware to add rate limit info to response headers
 */
function rateLimitInfo(req, res, next) {
  if (req.rateLimit) {
    res.set({
      'X-RateLimit-Limit': req.rateLimit.limit,
      'X-RateLimit-Remaining': req.rateLimit.remaining,
      'X-RateLimit-Reset': new Date(req.rateLimit.resetTime).toISOString()
    });
  }
  next();
}

module.exports = {
  createRateLimiter,
  apiLimiter,
  authLimiter,
  heavyLimiter,
  createPlanBasedLimiter,
  rateLimitInfo
};