// src/routes/coupon.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const couponController = require('../controllers/coupon.controller');
const authController = require('../controllers/auth.controller');

// Public routes
router.post('/validate', couponController.validateCoupon);
router.post('/increment-usage', couponController.incrementCouponUsage);

// Routes requiring authentication
router.use(authenticate);

// Customer routes
router.get('/my-coupons', couponController.getMyCoupons);
router.post('/apply', validate({
  body: {
    code: 'required|string'
  }
}), couponController.applyCoupon);

// Admin routes
router.use(authorize(['admin']));

router
  .route('/')
  .get(couponController.getAllCoupons)
  .post(couponController.createCoupon);

router
  .route('/:id')
  .get(couponController.getCoupon)
  .patch(couponController.updateCoupon)
  .delete(couponController.deleteCoupon);

router.patch('/:id/toggle-status', couponController.toggleCouponStatus);

// Bulk operations
router.post('/bulk/create', validate({
  body: {
    coupons: 'required|array'
  }
}), couponController.bulkCreateCoupons);

router.put('/bulk/update', validate({
  body: {
    coupons: 'required|array'
  }
}), couponController.bulkUpdateCoupons);

router.delete('/bulk/delete', validate({
  body: {
    ids: 'required|array'
  }
}), couponController.bulkDeleteCoupons);

// Coupon status management
router.put('/:id/status', validate({
  body: {
    isActive: 'required|boolean'
  }
}), couponController.updateCouponStatus);

// Analytics
router.get('/analytics/usage', couponController.getCouponUsageAnalytics);
router.get('/analytics/performance', couponController.getCouponPerformanceMetrics);

// Export functionality
router.get('/export', couponController.exportCoupons);

module.exports = router;