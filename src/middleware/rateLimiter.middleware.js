// src/middleware/rateLimiter.middleware.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/cache');
const AppError = require('../utils/appError');

// Create different rate limiters for different purposes
const createRateLimiter = (options) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    statusCode: 429,
    headers: true,
    handler: (req, res, next) => {
      next(new AppError('Too many requests, please try again later.', 429));
    },
    store: new RedisStore({
      client: redis.client,
      prefix: 'rate-limit:'
    })
  };

  return rateLimit({
    ...defaultOptions,
    ...options
  });
};

// General API rate limiter
exports.apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Auth routes rate limiter (more strict)
exports.authLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 login attempts per hour
  message: 'Too many login attempts, please try again after an hour'
});

// User account creation rate limiter
exports.createAccountLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3 // limit each IP to 3 account creations per hour
});

// Password reset rate limiter
exports.passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3 // limit each IP to 3 password resets per hour
});

// Search rate limiter
exports.searchLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30 // limit each IP to 30 search requests per 5 minutes
});

// API key rate limiter (for authenticated requests)
exports.apiKeyLimiter = (maxRequests = 1000) => createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: maxRequests,
  keyGenerator: (req) => req.user?.apiKey || req.ip
});

// Custom rate limiter for specific routes or users
exports.customRateLimiter = (windowMs, max, message) => createRateLimiter({
  windowMs,
  max,
  message
});