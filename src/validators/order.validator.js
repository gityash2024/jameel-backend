// src/validators/order.validator.js
const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

exports.createOrder = [
  body('shippingAddress')
    .isObject()
    .withMessage('Shipping address is required'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['credit_card', 'debit_card', 'paypal', 'cash_on_delivery', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('shippingMethod')
    .notEmpty()
    .withMessage('Shipping method is required')
];

exports.cancelOrder = [
  body('cancelReason')
    .notEmpty()
    .withMessage('Cancellation reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Cancellation reason must be between 10 and 500 characters')
];

exports.processPayment = [
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required')
];

exports.setupLayaway = [
  body('downPayment')
    .notEmpty()
    .withMessage('Down payment is required')
    .isFloat({ min: 0 })
    .withMessage('Down payment must be a positive number'),
  body('numberOfInstallments')
    .notEmpty()
    .withMessage('Number of installments is required')
    .isInt({ min: 2, max: 12 })
    .withMessage('Number of installments must be between 2 and 12')
];

exports.payLayawayInstallment = [
  body('installmentId')
    .notEmpty()
    .withMessage('Installment ID is required'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required')
];

exports.updateOrder = [
  body('orderStatus')
    .optional()
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'])
    .withMessage('Invalid order status'),
  body('paymentStatus')
    .optional()
    .isIn(['pending', 'processing', 'paid', 'failed', 'refunded'])
    .withMessage('Invalid payment status')
];

exports.updateOrderStatus = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'])
    .withMessage('Invalid order status')
];

exports.updateShipping = [
  body('trackingNumber')
    .notEmpty()
    .withMessage('Tracking number is required'),
  body('estimatedDeliveryDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid delivery date format')
];

exports.processRefund = [
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Refund amount must be a positive number'),
  body('reason')
    .notEmpty()
    .withMessage('Refund reason is required')
];

exports.updateRefundStatus = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'processing', 'completed', 'failed'])
    .withMessage('Invalid refund status')
];
exports.createOrder = [
  body('items')
    .isArray()
    .withMessage('Items must be an array')
    .notEmpty()
    .withMessage('Order must contain at least one item'),

  body('items.*.product')
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid product ID'),

  body('items.*.quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),

  body('shippingAddress')
    .isObject()
    .withMessage('Shipping address is required')
    .custom((value) => {
      const requiredFields = ['firstName', 'lastName', 'addressLine1', 'city', 'state', 'postalCode', 'country', 'phone'];
      const missingFields = requiredFields.filter(field => !value[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      return true;
    }),

  body('billingAddress')
    .optional()
    .isObject()
    .withMessage('Billing address must be an object')
    .custom((value) => {
      if (value) {
        const requiredFields = ['firstName', 'lastName', 'addressLine1', 'city', 'state', 'postalCode', 'country', 'phone'];
        const missingFields = requiredFields.filter(field => !value[field]);
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
      }
      return true;
    }),

  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery', 'bank_transfer'])
    .withMessage('Invalid payment method'),

  body('shippingMethod')
    .notEmpty()
    .withMessage('Shipping method is required'),

  body('couponCode')
    .optional()
    .isString()
    .trim(),

  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('isGift')
    .optional()
    .isBoolean()
    .withMessage('isGift must be a boolean'),

  body('giftMessage')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Gift message cannot exceed 200 characters'),

  body('layaway')
    .optional()
    .isObject()
    .withMessage('Layaway must be an object')
    .custom((value) => {
      if (value && value.isLayaway) {
        if (!value.downPayment || value.downPayment <= 0) {
          throw new Error('Down payment is required for layaway');
        }
      }
      return true;
    })
];

exports.updateOrder = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid order ID'),

  body('orderStatus')
    .optional()
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'])
    .withMessage('Invalid order status'),

  body('trackingNumber')
    .optional()
    .isString()
    .trim(),

  body('estimatedDeliveryDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid delivery date format'),

  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

exports.cancelOrder = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid order ID'),

  body('cancelReason')
    .notEmpty()
    .withMessage('Cancellation reason is required')
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters')
];

exports.processPayment = [
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),

  body('savePaymentMethod')
    .optional()
    .isBoolean()
    .withMessage('savePaymentMethod must be a boolean')
];

exports.setupLayaway = [
  body('downPayment')
    .notEmpty()
    .withMessage('Down payment is required')
    .isFloat({ min: 0 })
    .withMessage('Down payment must be a positive number'),

  body('numberOfInstallments')
    .notEmpty()
    .withMessage('Number of installments is required')
    .isInt({ min: 2, max: 12 })
    .withMessage('Number of installments must be between 2 and 12')
];

exports.payLayawayInstallment = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid order ID'),

  body('amount')
    .notEmpty()
    .withMessage('Payment amount is required')
    .isFloat({ min: 0 })
    .withMessage('Payment amount must be a positive number'),

  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required')
];

exports.searchOrders = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),

  query('status')
    .optional()
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'])
    .withMessage('Invalid order status'),

  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be a positive number'),

  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum amount must be a positive number'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];