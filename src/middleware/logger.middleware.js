// src/middleware/logger.middleware.js
const morgan = require('morgan');
const logger = require('../config/logging');
const AppError = require('../utils/appError');

// Custom token for response time in milliseconds
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '';
  }
  
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

// Custom token for user ID (if authenticated)
morgan.token('user-id', (req) => {
  return req.user ? req.user._id : 'anonymous';
});

// Custom token for request body
morgan.token('body', (req) => {
  // Remove sensitive information
  const body = { ...req.body };
  delete body.password;
  delete body.passwordConfirm;
  delete body.token;
  
  return JSON.stringify(body);
});

// Custom format string
const developmentFormat = ':method :url :status :response-time-ms ms - :user-id - :body';
const productionFormat = ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

// Create middleware based on environment
const morganMiddleware = morgan(
  process.env.NODE_ENV === 'development' ? developmentFormat : productionFormat,
  {
    stream: {
      write: (message) => logger.http(message.trim())
    },
    skip: (req, res) => {
      // Skip logging for health check endpoints
      if (req.url.includes('/health')) {
        return true;
      }
      return false;
    }
  }
);

// Request logging middleware
const requestLogger = (req, res, next) => {
  req._startAt = process.hrtime();
  
  // Log request details
  logger.info({
    type: 'request',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user._id : 'anonymous',
    userAgent: req.get('user-agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  // Log response
  const originalSend = res.send;
  res.send = function (body) {
    res._startAt = process.hrtime();
    
    // Log response details
    logger.info({
      type: 'response',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: calculateResponseTime(req._startAt, res._startAt),
      timestamp: new Date().toISOString()
    });

    return originalSend.call(this, body);
  };

  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error({
    type: 'error',
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user ? req.user._id : 'anonymous',
    timestamp: new Date().toISOString()
  });

  next(err);
};

// Helper function to calculate response time
const calculateResponseTime = (start, end) => {
  if (!start || !end) return 0;
  
  const ms = (end[0] - start[0]) * 1e3 +
    (end[1] - start[1]) * 1e-6;
  return ms.toFixed(3);
};

module.exports = {
  morganMiddleware,
  requestLogger,
  errorLogger
};