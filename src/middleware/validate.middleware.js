const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

const validate = (validations) => {
  return async (req, res, next) => {
    try {
      if (Array.isArray(validations)) {
        for (let validation of validations) {
          await validation.run(req);
        }
      } else {
        await validations.run(req);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }));

        return next(new AppError('Validation failed', 400, errorMessages));
      }

      next();
    } catch (error) {
      next(new AppError('Validation error', 400));
    }
  };
};

const customValidators = {
  isValidObjectId: (value) => {
    if (!value.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error('Invalid ID format');
    }
    return true;
  },

  isValidDate: (value) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    return true;
  },

  isValidPhone: (value) => {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!phoneRegex.test(value)) {
      throw new Error('Invalid phone number format');
    }
    return true;
  },

  isStrongPassword: (value) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(value)) {
      throw new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number and special character');
    }
    return true;
  },

  isValidEmail: (value) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(value)) {
      throw new Error('Invalid email format');
    }
    return true;
  },

  isValidURL: (value) => {
    try {
      new URL(value);
      return true;
    } catch (error) {
      throw new Error('Invalid URL format');
    }
  },

  isValidImageType: (value) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(value)) {
      throw new Error('Invalid image type. Allowed types: JPEG, PNG, GIF, WEBP');
    }
    return true;
  },

  isValidFileSize: (maxSize) => (value) => {
    if (value > maxSize) {
      throw new Error(`File size cannot exceed ${maxSize / (1024 * 1024)}MB`);
    }
    return true;
  },

  isValidPrice: (value) => {
    if (isNaN(value) || value < 0) {
      throw new Error('Price must be a positive number');
    }
    return true;
  },

  isValidQuantity: (value) => {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Quantity must be a positive integer');
    }
    return true;
  }
};

module.exports = {
  validate,
  customValidators
};