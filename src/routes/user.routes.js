// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const userController = require('../controllers/user.controller');

// All routes require authentication
router.use(authenticate);

// Profile management
router.get('/profile', userController.getProfile);
router.put('/profile', validate({
  body: {
    firstName: 'string',
    lastName: 'string',
    phone: 'string',
    gender: 'string|in:male,female,other',
    dateOfBirth: 'date'
  }
}), userController.updateProfile);

router.put('/profile/avatar', 
  userController.uploadAvatar,
  userController.updateAvatar
);

// Address management
router.get('/addresses', userController.getAddresses);
router.post('/addresses', validate({
  body: {
    type: 'required|string|in:home,work,other',
    firstName: 'required|string',
    lastName: 'required|string',
    address1: 'required|string',
    address2: 'string',
    city: 'required|string',
    state: 'required|string',
    postalCode: 'required|string',
    country: 'required|string',
    phone: 'required|string',
    isDefault: 'boolean'
  }
}), userController.addAddress);

router.put('/addresses/:id', validate({
  body: {
    type: 'string|in:home,work,other',
    firstName: 'string',
    lastName: 'string',
    address1: 'string',
    address2: 'string',
    city: 'string',
    state: 'string',
    postalCode: 'string',
    country: 'string',
    phone: 'string',
    isDefault: 'boolean'
  }
}), userController.updateAddress);

router.delete('/addresses/:id', userController.deleteAddress);
router.put('/addresses/:id/default', userController.setDefaultAddress);

// Wishlist management
router.get('/wishlist', userController.getWishlist);
router.post('/wishlist', validate({
  body: {
    productId: 'required|string'
  }
}), userController.addToWishlist);
router.delete('/wishlist/:productId', userController.removeFromWishlist);

// Notification preferences
router.get('/notifications/preferences', userController.getNotificationPreferences);
router.put('/notifications/preferences', validate({
  body: {
    email: 'required|boolean',
    sms: 'required|boolean',
    orderUpdates: 'required|boolean',
    promotions: 'required|boolean',
    newsletter: 'required|boolean'
  }
}), userController.updateNotificationPreferences);

// Payment methods
router.get('/payment-methods', userController.getPaymentMethods);
router.post('/payment-methods', validate({
  body: {
    type: 'required|string|in:credit_card,debit_card',
    token: 'required|string'
  }
}), userController.addPaymentMethod);
router.delete('/payment-methods/:id', userController.deletePaymentMethod);
router.put('/payment-methods/:id/default', userController.setDefaultPaymentMethod);

// Recently viewed products
router.get('/recently-viewed', userController.getRecentlyViewed);
router.post('/recently-viewed/:productId', userController.addToRecentlyViewed);

module.exports = router;