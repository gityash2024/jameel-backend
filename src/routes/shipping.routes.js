// src/routes/shipping.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const shippingController = require('../controllers/shipping.controller');
const {cache} = require('../middleware/cache.middleware');

// Public routes
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

router.get('/methods', cache('1 day'), shippingController.getShippingMethods);
router.get('/countries', cache('1 day'), shippingController.getSupportedCountries);

// Commenting out problematic routes that reference undefined methods
// router.get('/track/:trackingNumber', shippingController.trackShipment);
router.post('/rates', shippingController.calculateShippingRates);
// router.post('/options', shippingController.getShippingOptions);

// Authentication required for all routes below
router.use(authenticate);

// Customer routes
router.get('/my-shipments', shippingController.getMyShipments);
router.get('/my-shipments/:id', shippingController.getShipmentById);
router.get('/track/:orderId', shippingController.trackShipment);

// Admin routes
router.use(authorize(['admin']));

// Shipping methods management
router.post('/methods', validate({
  body: {
    name: 'required|string',
    carrier: 'required|string',
    method: 'required|string|in:standard,express,overnight,international',
    zones: 'required|array',
    restrictions: 'object',
    estimatedDays: 'object'
  }
}), shippingController.createShippingMethod);

router.put('/methods/:id', validate({
  body: {
    name: 'string',
    carrier: 'string',
    method: 'string|in:standard,express,overnight,international',
    zones: 'array',
    restrictions: 'object',
    estimatedDays: 'object'
  }
}), shippingController.updateShippingMethod);

router.delete('/methods/:id', shippingController.deleteShippingMethod);

// Shipping zones management
router.post('/zones', validate({
  body: {
    name: 'required|string',
    countries: 'required|array',
    states: 'array',
    rates: 'required|array'
  }
}), shippingController.createShippingZone);

router.put('/zones/:id', validate({
  body: {
    name: 'string',
    countries: 'array',
    states: 'array',
    rates: 'array'
  }
}), shippingController.updateShippingZone);

router.delete('/zones/:id', shippingController.deleteShippingZone);

// Shipment management
// Comment out routes with potentially undefined controller methods
// router.get('/shipments', shippingController.getAllShipments);
// router.post('/shipments', validate({
//   body: {
//     orderId: 'required|string',
//     method: 'required|string',
//     address: 'required|object'
//   }
// }), shippingController.createShipment);

// router.put('/shipments/:id', validate({
//   body: {
//     trackingNumber: 'string',
//     status: 'string',
//     estimatedDeliveryDate: 'date'
//   }
// }), shippingController.updateShipment);

// Label generation
// router.post('/labels', validate({
//   body: {
//     shipmentId: 'required|string',
//     format: 'string|in:pdf,zpl'
//   }
// }), shippingController.generateShippingLabel);

// Bulk operations
// router.post('/shipments/bulk', validate({
//   body: {
//     shipments: 'required|array',
//     'shipments.*.orderId': 'required|string',
//     'shipments.*.method': 'required|string'
//   }
// }), shippingController.bulkCreateShipments);

// router.post('/labels/bulk', validate({
//   body: {
//     shipmentIds: 'required|array'
//   }
// }), shippingController.bulkGenerateLabels);

// Returns
// router.post('/returns', validate({
//   body: {
//     orderId: 'required|string',
//     items: 'required|array',
//     reason: 'required|string',
//     address: 'required|object'
//   }
// }), shippingController.createReturn);

// router.get('/returns', shippingController.getAllReturns);
// router.get('/returns/:id', shippingController.getReturnById);
// router.put('/returns/:id/status', shippingController.updateReturnStatus);


// Analytics routes (continued)
// router.get('/analytics/returns', shippingController.getReturnsAnalytics);
// router.get('/analytics/carriers', shippingController.getCarrierPerformanceAnalytics);
// router.get('/analytics/zones', shippingController.getShippingZonesAnalytics);

// Carrier integration routes
// router.post('/carriers/sync', shippingController.syncCarrierRates);
// router.get('/carriers/services', shippingController.getCarrierServices);
// router.post('/carriers/validate-address', validate({
//   body: {
//     address: 'required|object'
//   }
// }), shippingController.validateAddress);

// Settings routes
// router.get('/settings', shippingController.getShippingSettings);
// router.put('/settings', validate({
//   body: {
//     defaultCarrier: 'string',
//     freeShippingThreshold: 'number',
//     handlelingFee: 'number',
//     insuranceSettings: 'object',
//     packagingTypes: 'array'
//   }
// }), shippingController.updateShippingSettings);

// Export functionality
// router.get('/export/shipments', shippingController.exportShipments);
// router.get('/export/returns', shippingController.exportReturns);

// Keep only the routes that have corresponding controller methods
router.post('/orders/:orderId/create-shipment', shippingController.createShipment);
// Commenting out this route as the cancelShipment method doesn't appear to exist
// router.post('/orders/:orderId/cancel-shipment', shippingController.cancelShipment);

module.exports = router;