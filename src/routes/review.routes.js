// src/routes/review.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const reviewController = require('../controllers/review.controller');
const {cache} = require('../middleware/cache.middleware');

// Public routes
router.get('/product/:productId', cache('5 minutes'), reviewController.getProductReviews);
router.get('/stats/product/:productId', cache('10 minutes'), reviewController.getProductReviewStats);

// Authentication required routes
router.use(authenticate);

// Customer routes
router.get('/my-reviews', reviewController.getMyReviews);

router.post('/', validate({
  body: {
    productId: 'required|string',
    rating: 'required|integer|min:1|max:5',
    title: 'required|string|max:100',
    content: 'required|string',
    images: 'array'
  }
}), reviewController.uploadReviewImages, reviewController.createReview);

router.put('/:id', validate({
  body: {
    rating: 'integer|min:1|max:5',
    title: 'string|max:100',
    content: 'string',
    images: 'array'
  }
}), reviewController.uploadReviewImages, reviewController.updateReview);

router.delete('/:id', reviewController.deleteReview);

// Review interactions
router.post('/:id/helpful', reviewController.markReviewHelpful);
router.delete('/:id/helpful', reviewController.removeHelpfulMark);

router.post('/:id/report', validate({
  body: {
    reason: 'required|string'
  }
}), reviewController.reportReview);

// Admin routes
router.use(authorize(['admin']));

router.get('/', reviewController.getAllReviews);
router.get('/:id', reviewController.getReviewById);

// Review moderation
router.put('/:id/status', validate({
  body: {
    status: 'required|string|in:pending,approved,rejected',
    moderationNotes: 'string'
  }
}), reviewController.updateReviewStatus);

router.post('/bulk/moderate', validate({
  body: {
    reviews: 'required|array',
    'reviews.*.id': 'required|string',
    'reviews.*.status': 'required|string|in:pending,approved,rejected'
  }
}), reviewController.bulkModerateReviews);

// Reporting and analytics
router.get('/analytics/overview', reviewController.getReviewAnalytics);
router.get('/analytics/ratings', reviewController.getRatingAnalytics);
router.get('/analytics/trending', reviewController.getTrendingReviews);

// Product review summary
router.get('/summary/product/:productId', reviewController.getProductReviewSummary);
router.get('/summary/category/:categoryId', reviewController.getCategoryReviewSummary);

// Export functionality
router.get('/export', validate({
  query: {
    status: 'string',
    startDate: 'date',
    endDate: 'date'
  }
}), reviewController.exportReviews);

module.exports = router;