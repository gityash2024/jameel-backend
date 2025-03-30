/**
 * Simple logger utility
 */

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = process.env.LOG_LEVEL ? logLevels[process.env.LOG_LEVEL] || 2 : 2;

/**
 * Format the log message with timestamp
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [meta] - Additional metadata
 * @returns {string} Formatted log message
 */
const formatLogMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const formattedLevel = level.toUpperCase().padEnd(5);
  
  let formattedMessage = `[${timestamp}] ${formattedLevel} ${message}`;
  
  if (Object.keys(meta).length > 0) {
    try {
      formattedMessage += ` ${JSON.stringify(meta)}`;
    } catch (error) {
      formattedMessage += ` [Error serializing metadata: ${error.message}]`;
    }
  }
  
  return formattedMessage;
};

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {Object} [meta] - Additional metadata
 */
const error = (message, meta) => {
  if (currentLevel >= logLevels.error) {
    console.error(formatLogMessage('error', message, meta));
  }
};

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {Object} [meta] - Additional metadata
 */
const warn = (message, meta) => {
  if (currentLevel >= logLevels.warn) {
    console.warn(formatLogMessage('warn', message, meta));
  }
};

/**
 * Log an info message
 * @param {string} message - Info message
 * @param {Object} [meta] - Additional metadata
 */
const info = (message, meta) => {
  if (currentLevel >= logLevels.info) {
    console.info(formatLogMessage('info', message, meta));
  }
};

/**
 * Log a debug message
 * @param {string} message - Debug message
 * @param {Object} [meta] - Additional metadata
 */
const debug = (message, meta) => {
  if (currentLevel >= logLevels.debug) {
    console.debug(formatLogMessage('debug', message, meta));
  }
};

module.exports = {
  error,
  warn,
  info,
  debug
}; 