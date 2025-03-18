// src/routes/cart.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const cartController = require('../controllers/cart.controller');

// All cart routes require authentication
router.use(authenticate);

// Cart management
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);

router.put('/items/:itemId', cartController.updateItem);

router.delete('/items/:itemId', cartController.removeItem);
router.delete('/', cartController.clearCart);

// Apply/remove coupon
router.post('/apply-coupon', cartController.applyCoupon);

router.delete('/remove-coupon', cartController.removeCoupon);

// Shipping calculations
router.post('/calculate-shipping', cartController.calculateShipping);

// Save for later functionality
router.post('/items/:itemId/save-for-later', cartController.saveForLater);
router.post('/saved/:itemId/move-to-cart', cartController.moveToCart);
router.get('/saved-items', cartController.getSavedItems);

// Cart merge (when user logs in)
router.post('/merge', cartController.mergeCart);

// Cart summary and totals
router.get('/summary', cartController.getCartSummary);

module.exports = router;