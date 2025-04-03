// src/routes/shipping.routes.js
const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate.middleware');
const shippingController = require('../controllers/shipping.controller');
const { cache } = require('../middleware/cache.middleware');
const orderController = require('../controllers/order.controller');

// Get shipping methods (cached)
router.get('/methods', cache('1 day'), shippingController.getShippingMethods);

// Get delivery estimate
router.get('/delivery-estimate', shippingController.getDeliveryEstimate);

// Track a shipment
router.get('/track/:trackingNumber', shippingController.trackShipment);

// Calculate shipping rates
router.post('/calculate', validate({
  body: {
    items: 'required|array',
    'items.*.productId': 'required|string',
    'items.*.quantity': 'required|integer|min:1',
    address: {
      country: 'required|string',
      state: 'required|string',
      postalCode: 'required|string'
    }
  }
}), shippingController.calculateShippingRates);

// Order tracking
router.get('/orders/:orderId/track', orderController.trackShipment);

module.exports = router;