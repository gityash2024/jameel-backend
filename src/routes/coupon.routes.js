// src/routes/coupon.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const couponController = require('../controllers/coupon.controller');

// Public routes
router.post('/validate', validate({
  body: {
    code: 'required|string',
    cartTotal: 'required|number'
  }
}), couponController.validateCoupon);

// Routes requiring authentication
router.use(authenticate);

// Customer routes
router.get('/my-coupons', couponController.getMyCoupons);
router.post('/apply', validate({
  body: {
    code: 'required|string',
    cartId: 'required|string'
  }
}), couponController.applyCoupon);

// Admin routes
router.use(authorize(['admin']));

router.get('/', couponController.getAllCoupons);
router.get('/:id', couponController.getCouponById);

router.post('/', validate({
  body: {
    code: 'required|string',
    type: 'required|string|in:percentage,fixed,free_shipping',
    value: 'required|number',
    minPurchase: 'number',
    maxDiscount: 'number',
    startDate: 'required|date',
    endDate: 'required|date',
    usageLimit: {
      perCoupon: 'integer',
      perUser: 'integer'
    },
    applicableProducts: 'array',
    excludedProducts: 'array',
    applicableCategories: 'array',
    description: 'string',
    terms: 'array'
  }
}), couponController.createCoupon);

router.put('/:id', validate({
  body: {
    code: 'string',
    type: 'string|in:percentage,fixed,free_shipping',
    value: 'number',
    minPurchase: 'number',
    maxDiscount: 'number',
    startDate: 'date',
    endDate: 'date',
    usageLimit: 'object',
    applicableProducts: 'array',
    excludedProducts: 'array',
    applicableCategories: 'array',
    description: 'string',
    terms: 'array'
  }
}), couponController.updateCoupon);

router.delete('/:id', couponController.deleteCoupon);

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