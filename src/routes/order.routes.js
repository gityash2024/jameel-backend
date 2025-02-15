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
router.post('/:id/cancel', validate(orderValidator.cancelOrder), orderController.cancelOrder);

// Payment related routes
router.post('/:id/pay', validate(orderValidator.processPayment), orderController.processPayment);
router.post('/:id/verify-payment', orderController.verifyPayment);

// Layaway related routes
router.post('/:id/layaway', validate(orderValidator.setupLayaway), orderController.setupLayaway);
router.post('/:id/layaway/installment', validate(orderValidator.payLayawayInstallment), orderController.payLayawayInstallment);

// Admin routes
router.use(authorize(['admin']));

router.get('/', orderController.getAllOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id', validate(orderValidator.updateOrder), orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

// Order status management
router.put('/:id/status', validate(orderValidator.updateOrderStatus), orderController.updateOrderStatus);
router.put('/:id/shipping', validate(orderValidator.updateShipping), orderController.updateShipping);

// Refund routes
router.post('/:id/refund', validate(orderValidator.processRefund), orderController.processRefund);
router.put('/:id/refund/status', validate(orderValidator.updateRefundStatus), orderController.updateRefundStatus);

// Export routes
router.get('/export/csv', orderController.exportOrdersCsv);
router.get('/export/pdf/:id', orderController.generateOrderInvoice);

// Analytics routes
router.get('/analytics/summary', orderController.getOrderAnalytics);
router.get('/analytics/sales', orderController.getSalesAnalytics);

module.exports = router;