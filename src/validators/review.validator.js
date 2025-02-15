// src/validators/review.validator.js
const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

exports.createReview = [
  body('product')
    .notEmpty()
    .withMessage('Product ID is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid product ID'),

  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('title')
    .notEmpty()
    .withMessage('Review title is required')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),

  body('content')
    .notEmpty()
    .withMessage('Review content is required')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Review content must be between 10 and 1000 characters'),

  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array')
    .custom((value) => {
      if (value.length > 5) {
        throw new Error('Maximum 5 images allowed');
      }
      return true;
    })
];

exports.updateReview = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid review ID'),

  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),

  body('content')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Review content must be between 10 and 1000 characters'),

  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array')
    .custom((value) => {
      if (value.length > 5) {
        throw new Error('Maximum 5 images allowed');
      }
      return true;
    })
];

exports.moderateReview = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid review ID'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Invalid status'),

  body('moderationNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Moderation notes cannot exceed 500 characters')
];

exports.reportReview = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid review ID'),

  body('reason')
    .notEmpty()
    .withMessage('Report reason is required')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Report reason must be between 10 and 500 characters')
];

exports.getProductReviews = [
  param('productId')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid product ID'),

  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Invalid rating filter'),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'highest_rating', 'lowest_rating', 'most_helpful'])
    .withMessage('Invalid sort parameter'),

  query('verified')
    .optional()
    .isBoolean()
    .withMessage('Verified parameter must be a boolean'),

  query('hasImages')
    .optional()
    .isBoolean()
    .withMessage('HasImages parameter must be a boolean'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

exports.bulkModerateReviews = [
  body('reviews')
    .isArray()
    .withMessage('Reviews must be an array')
    .notEmpty()
    .withMessage('Reviews array cannot be empty'),

  body('reviews.*.id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid review ID'),

  body('reviews.*.status')
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Invalid status'),

  body('reviews.*.moderationNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Moderation notes cannot exceed 500 characters')
];

exports.replyToReview = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid review ID'),

  body('content')
    .notEmpty()
    .withMessage('Reply content is required')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reply must be between 10 and 500 characters')
];