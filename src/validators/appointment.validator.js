// src/validators/appointment.validator.js
const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const moment = require('moment');

exports.createAppointment = [
  body('service')
    .notEmpty()
    .withMessage('Service is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid service ID'),

  body('store')
    .notEmpty()
    .withMessage('Store is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid store ID'),

  body('appointmentDate')
    .notEmpty()
    .withMessage('Appointment date is required')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom(value => {
      if (moment(value).isBefore(moment(), 'day')) {
        throw new Error('Appointment date cannot be in the past');
      }
      return true;
    }),

  body('timeSlot')
    .isObject()
    .withMessage('Time slot must be an object')
    .custom((value) => {
      if (!value.startTime || !value.endTime) {
        throw new Error('Start time and end time are required');
      }
      if (!moment(value.startTime, 'HH:mm').isValid() || !moment(value.endTime, 'HH:mm').isValid()) {
        throw new Error('Invalid time format');
      }
      if (moment(value.endTime, 'HH:mm').isSameOrBefore(moment(value.startTime, 'HH:mm'))) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),

  body('serviceDetails')
    .optional()
    .isObject()
    .withMessage('Service details must be an object'),

  body('specialRequests')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special requests cannot exceed 500 characters')
];

exports.updateAppointment = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid appointment ID'),

  body('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
    .custom(value => {
      if (moment(value).isBefore(moment(), 'day')) {
        throw new Error('Appointment date cannot be in the past');
      }
      return true;
    }),

  body('timeSlot')
    .optional()
    .isObject()
    .withMessage('Time slot must be an object')
    .custom((value) => {
      if (value) {
        if (!value.startTime || !value.endTime) {
          throw new Error('Start time and end time are required');
        }
        if (!moment(value.startTime, 'HH:mm').isValid() || !moment(value.endTime, 'HH:mm').isValid()) {
          throw new Error('Invalid time format');
        }
        if (moment(value.endTime, 'HH:mm').isSameOrBefore(moment(value.startTime, 'HH:mm'))) {
          throw new Error('End time must be after start time');
        }
      }
      return true;
    }),

  body('status')
    .optional()
    .isIn(Object.values(APPOINTMENT_STATUS))
    .withMessage('Invalid appointment status'),

  body('specialRequests')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special requests cannot exceed 500 characters')
];

exports.getAppointments = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (req.query.startDate && moment(value).isBefore(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('status')
    .optional()
    .isIn(Object.values(APPOINTMENT_STATUS))
    .withMessage('Invalid appointment status'),

  query('service')
    .optional()
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid service ID'),

  query('store')
    .optional()
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid store ID'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

exports.assignStaff = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid appointment ID'),

  body('staffId')
    .notEmpty()
    .withMessage('Staff ID is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid staff ID')
];

exports.updateReminderSettings = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid appointment ID'),

  body('isEnabled')
    .isBoolean()
    .withMessage('isEnabled must be a boolean'),

  body('timing')
    .optional()
    .isArray()
    .withMessage('Timing must be an array')
    .custom(value => {
      if (!value.every(time => time > 0)) {
        throw new Error('Reminder times must be positive numbers');
      }
      return true;
    })
];

exports.cancelAppointment = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid appointment ID'),

  body('cancelReason')
    .notEmpty()
    .withMessage('Cancellation reason is required')
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Cancellation reason must be between 10 and 500 characters')
];

// Custom design appointment validator
exports.createCustomDesignAppointment = [
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isString()
    .trim(),

  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isString()
    .trim(),

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[0-9\s\-()]{7,15}$/)
    .withMessage('Please enter a valid phone number'),

  body('productType')
    .notEmpty()
    .withMessage('Product type is required')
    .isString()
    .trim(),

  body('appointmentDate')
    .notEmpty()
    .withMessage('Appointment date is required')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom(value => {
      if (moment(value).isBefore(moment(), 'day')) {
        throw new Error('Appointment date cannot be in the past');
      }
      return true;
    }),

  body('appointmentTime')
    .notEmpty()
    .withMessage('Appointment time is required')
    .isString()
    .trim(),

  body('storeId')
    .notEmpty()
    .withMessage('Store is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid store ID'),

  body('stoneType')
    .optional()
    .isString()
    .trim(),

  body('stoneColor')
    .optional()
    .isString()
    .trim(),

  body('carat')
    .optional()
    .isString()
    .trim(),

  body('metalType')
    .optional()
    .isString()
    .trim(),

  body('message')
    .optional()
    .isString()
    .trim(),

  body('shoppingFor')
    .optional()
    .isIn(['myself', 'someone'])
    .withMessage('Shopping for must be either "myself" or "someone"'),

  body('isSpecialOccasion')
    .optional()
    .isBoolean()
    .withMessage('isSpecialOccasion must be a boolean')
];