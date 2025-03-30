// src/routes/order.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const orderValidator = require('../validators/order.validator');
const orderController = require('../controllers/order.controller');

// All order routes require authentication
router.use(authenticate);

// Customer routes
router.post('/', validate(orderValidator.createOrder), orderController.createOrder);
router.get('/my-orders', orderController.getMyOrders);
router.get('/my-orders/:id', orderController.getMyOrderById);
router.put('/my-orders/:id/cancel', validate(orderValidator.cancelOrder), orderController.cancelOrder);
router.post('/:id/payment', validate(orderValidator.processPayment), orderController.processPayment);
router.post('/:id/layaway', validate(orderValidator.setupLayaway), orderController.setupLayaway);
router.post('/:id/layaway/installment', validate(orderValidator.payLayawayInstallment), orderController.payLayawayInstallment);

// Admin only routes
router.use(authorize('admin', 'manager'));

// Dashboard stats
router.get('/stats', orderController.getDashboardStats);

router.get('/', orderController.getAllOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id', validate(orderValidator.updateOrder), orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

// Order status management
router.put('/:id/status', validate(orderValidator.updateOrderStatus), orderController.updateOrderStatus);
router.put('/:id/payment/verify', orderController.verifyPayment);
router.put('/:id/shipping', orderController.updateShipping);

// Tracking route
router.get('/:id/track', orderController.trackShipment);

// Refund routes
router.post('/:id/refund', validate(orderValidator.processRefund), orderController.processRefund);
router.put('/:id/refund/status', validate(orderValidator.updateRefundStatus), orderController.updateRefundStatus);

// Export routes
router.get('/export/csv', orderController.exportOrdersCsv);
router.get('/:id/invoice', orderController.generateOrderInvoice);

// Analytics routes
router.get('/analytics/orders', orderController.getOrderAnalytics);
router.get('/analytics/sales', orderController.getSalesAnalytics);

module.exports = router;