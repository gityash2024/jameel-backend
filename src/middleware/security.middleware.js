// src/middleware/security.middleware.js
const helmet = require('helmet');
const hpp = require('hpp');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');

// CORS options
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000'];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// Helmet configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
};

// HPP configuration for query parameter pollution
const hppConfig = {
  whitelist: [
    'price',
    'rating',
    'sort',
    'fields',
    'page',
    'limit',
    'category',
    'tags'
  ]
};

// Security middleware functions
const securityMiddleware = {
  // Apply Helmet security headers
  helmet: helmet(helmetConfig),

  // Apply CORS
  cors: cors(corsOptions),

  // Prevent Parameter Pollution
  hpp: hpp(hppConfig),

  // Sanitize data against XSS
  xss: xss(),

  // Sanitize data against NoSQL query injection
  mongoSanitize: mongoSanitize(),

  // Custom security headers
  customSecurityHeaders: (req, res, next) => {
    // Remove powered by header
    res.removeHeader('X-Powered-By');
    
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Feature Policy
    res.setHeader('Permissions-Policy', 
      'geolocation=(), ' +
      'microphone=(), ' +
      'camera=(), ' +
      'payment=(self), ' +
      'usb=(), ' +
      'fullscreen=(self)'
    );

    next();
  },

  // Check for secure connection
  requireHttps: (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  }
};

module.exports = securityMiddleware;