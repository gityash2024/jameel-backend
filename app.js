const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const errorHandler = require('./src/middleware/errorHandler');
const { notFound } = require('./src/middleware/notFound');
const morgan = require('morgan');
const chalk = require('chalk');

console.log(chalk.blue('Initializing Express application...'));

// Initialize express app
const app = express();

// Load environment variables
require('dotenv').config();

console.log(chalk.green('Current environment:'), process.env.NODE_ENV);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'https://jameel-web.vercel.app', 'https://jameel-admin.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Server is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API Routes
console.log(chalk.yellow('Setting up routes...'));
try {
  const indexRoutes = require('./src/routes/index.routes');
  
  // Logging function for routes
  function logRoutes(routes, parentPath = '/api/v1') {
    if (routes.stack) {
      routes.stack.forEach(layer => {
        if (layer.route) {
          // Express route
          Object.keys(layer.route.methods).forEach(method => {
            console.log(
              chalk.green(`✓ Route: `) + 
              chalk.blue(`${method.toUpperCase().padEnd(6)} `) + 
              chalk.white(`${parentPath}${layer.route.path}`)
            );
          });
        } else if (layer.name === 'router') {
          // Nested router
          const routePath = layer.regexp.toString()
            .replace(/\/\^|\$/g, '')
            .replace(/\\/g, '');
          logRoutes(layer.handle, `${parentPath}${routePath}`);
        }
      });
    }
  }
// Root path welcome route
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Welcome to JSK Jewelry Backend API',
    version: '1.0.0',
    documentation: 'API documentation available at /api/v1/docs',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});
  // Mount routes and log them
  app.use('/api/v1', indexRoutes);
  console.log(chalk.yellow('Registered API Routes:'));
  logRoutes(indexRoutes);

} catch (error) {
  console.error(chalk.red('Error setting up routes:'), error);
  throw error;
}

// Handle 404 for undefined routes
app.use((req, res, next) => {
  console.log(
    chalk.red(`❌ Undefined Route: `) + 
    chalk.white(`${req.method} ${req.originalUrl}`)
  );
  next(new Error('Route not found'));
});

// Primary error handler
app.use(errorHandler);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(chalk.red('Unhandled Error:'), err);
  
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : {},
    timestamp: new Date().toISOString()
  });
});

console.log(chalk.green('Express application initialized successfully'));

module.exports = app;