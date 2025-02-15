const { body, param } = require('express-validator');
const User = require('../models/user.model');

const register = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .custom(async (value) => {
      const user = await User.findOne({ email: value.toLowerCase() });
      if (user) {
        throw new Error('Email already in use');
      }
      return true;
    }),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Please enter a valid phone number')
    .custom(async (value) => {
      const user = await User.findOne({ phone: value });
      if (user) {
        throw new Error('Phone number already in use');
      }
      return true;
    }),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),

  body('passwordConfirm')
    .trim()
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const login = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email'),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
];

const forgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
];

const resetPassword = [
  param('token')
    .trim()
    .notEmpty()
    .withMessage('Token is required'),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),

  body('passwordConfirm')
    .trim()
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const updatePassword = [
  body('currentPassword')
    .trim()
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password cannot be the same as current password');
      }
      return true;
    }),

  body('passwordConfirm')
    .trim()
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const updateDetails = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Please enter a valid phone number')
    .custom(async (value, { req }) => {
      const user = await User.findOne({ phone: value, _id: { $ne: req.user._id } });
      if (user) {
        throw new Error('Phone number already in use');
      }
      return true;
    })
];

const updateUser = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .custom(async (value, { req }) => {
      const user = await User.findOne({ email: value.toLowerCase(), _id: { $ne: req.params.id } });
      if (user) {
        throw new Error('Email already in use');
      }
      return true;
    }),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Please enter a valid phone number')
    .custom(async (value, { req }) => {
      const user = await User.findOne({ phone: value, _id: { $ne: req.params.id } });
      if (user) {
        throw new Error('Phone number already in use');
      }
      return true;
    })
];

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateDetails,
  updateUser
};