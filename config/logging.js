// src/config/logging.js
const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

// Define log directory
const logDir = 'logs';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Add colors to Winston
winston.addColors(colors);

// Define format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create file transports for different log levels
const fileTransports = [
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'error/%DATE%-error.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error'
  }),
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'debug/%DATE%-debug.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'debug'
  }),
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'access/%DATE%-access.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'http'
  })
];

// Create console transport based on environment
const consoleTransport = new winston.transports.Console({
  format: process.env.NODE_ENV === 'development' ? developmentFormat : productionFormat
});

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: process.env.NODE_ENV === 'development' ? developmentFormat : productionFormat,
  transports: [
    consoleTransport,
    ...fileTransports
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// Create stream for Morgan
logger.stream = {
  write: (message) => logger.http(message.trim())
};

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'error/exceptions.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Promise Rejection:', error);
});

module.exports = logger;