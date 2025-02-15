// src/utils/appError.js
class AppError extends Error {
    constructor(message, statusCode, errors = null) {
      super(message);
  
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
      this.errors = errors;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  // Error Types
  class ValidationError extends AppError {
    constructor(message = 'Validation Error', errors = null) {
      super(message, 422, errors);
      this.name = 'ValidationError';
    }
  }
  
  class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
      super(message, 401);
      this.name = 'AuthenticationError';
    }
  }
  
  class AuthorizationError extends AppError {
    constructor(message = 'Not authorized') {
      super(message, 403);
      this.name = 'AuthorizationError';
    }
  }
  
  class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
      super(message, 404);
      this.name = 'NotFoundError';
    }
  }
  
  class DuplicateError extends AppError {
    constructor(message = 'Duplicate resource') {
      super(message, 409);
      this.name = 'DuplicateError';
    }
  }
  
  class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
      super(message, 429);
      this.name = 'RateLimitError';
    }
  }
  
  // Error Handler functions
  const handleCastErrorDB = err => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
  };
  
  const handleDuplicateFieldsDB = err => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
  };
  
  const handleValidationErrorDB = err => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
  };
  
  const handleJWTError = () =>
    new AuthenticationError('Invalid token. Please log in again!');
  
  const handleJWTExpiredError = () =>
    new AuthenticationError('Your token has expired! Please log in again.');
  
  const handleMulterError = err => {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('File size too large', 400);
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return new AppError('Too many files', 400);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return new AppError('Unexpected field', 400);
    }
    return new AppError('File upload error', 400);
  };
  
  // Async Handler (Wrapper for async functions)
  const catchAsync = fn => {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  };
  
  // Error Handler Factory
  const createErrorFactory = (ErrorClass) => {
    return (message) => {
      return new ErrorClass(message);
    };
  };
  
  module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    DuplicateError,
    RateLimitError,
    handleCastErrorDB,
    handleDuplicateFieldsDB,
    handleValidationErrorDB,
    handleJWTError,
    handleJWTExpiredError,
    handleMulterError,
    catchAsync,
    createErrorFactory
  };