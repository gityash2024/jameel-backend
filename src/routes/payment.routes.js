// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const paymentController = require('../controllers/payment.controller');

// Middleware for Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// All routes below require authentication
router.use(authenticate);

// Payment methods management
router.get('/methods', paymentController.getPaymentMethods);
router.post('/methods', validate({
  body: {
    type: 'required|string|in:credit_card,debit_card',
    token: 'required|string'
  }
}), paymentController.addPaymentMethod);

router.delete('/methods/:id', paymentController.removePaymentMethod);
router.put('/methods/:id/default', paymentController.setDefaultPaymentMethod);

// Payment processing
router.post('/process', validate({
  body: {
    orderId: 'required|string',
    paymentMethodId: 'required|string',
    amount: 'required|number',
    currency: 'required|string'
  }
}), paymentController.processPayment);

router.post('/confirm', validate({
  body: {
    paymentIntentId: 'required|string'
  }
}), paymentController.confirmPayment);

// Refunds
router.post('/refund', validate({
  body: {
    paymentId: 'required|string',
    amount: 'required|number',
    reason: 'required|string'
  }
}), paymentController.processRefund);

// Payment plans and installments
router.post('/plans', validate({
  body: {
    orderId: 'required|string',
    numberOfInstallments: 'required|integer|min:2',
    frequency: 'required|string|in:weekly,biweekly,monthly'
  }
}), paymentController.createPaymentPlan);

router.get('/plans/:id', paymentController.getPaymentPlan);
router.post('/plans/:id/process-installment', paymentController.processInstallment);

// Gift cards
router.post('/gift-cards', validate({
  body: {
    amount: 'required|number',
    recipientEmail: 'required|email',
    message: 'string'
  }
}), paymentController.purchaseGiftCard);

router.get('/gift-cards', paymentController.getMyGiftCards);
router.post('/gift-cards/redeem', validate({
  body: {
    code: 'required|string'
  }
}), paymentController.redeemGiftCard);

router.get('/gift-cards/:id/balance', paymentController.checkGiftCardBalance);

// Layaway
router.post('/layaway', validate({
  body: {
    orderId: 'required|string',
    downPayment: 'required|number',
    duration: 'required|integer'
  }
}), paymentController.setupLayaway);

router.get('/layaway/:id', paymentController.getLayawayDetails);
router.post('/layaway/:id/payment', paymentController.processLayawayPayment);

// Admin only routes
router.use(authorize(['admin']));

// Payment administration
router.get('/transactions', paymentController.getAllTransactions);
router.get('/transactions/:id', paymentController.getTransactionById);

router.put('/transactions/:id/status', validate({
  body: {
    status: 'required|string|in:pending,processing,completed,failed,refunded'
  }
}), paymentController.updateTransactionStatus);

// Refund management
router.get('/refunds', paymentController.getAllRefunds);
router.get('/refunds/:id', paymentController.getRefundById);

// Payment analytics
router.get('/analytics/revenue', paymentController.getRevenueAnalytics);
router.get('/analytics/methods', paymentController.getPaymentMethodAnalytics);
router.get('/analytics/refunds', paymentController.getRefundAnalytics);

// Payment settings
router.get('/settings', paymentController.getPaymentSettings);
router.put('/settings', validate({
  body: {
    supportedMethods: 'array',
    minimumAmount: 'number',
    maxRefundPeriod: 'integer'
  }
}), paymentController.updatePaymentSettings);

// Export functionality
router.get('/export/transactions', paymentController.exportTransactions);

module.exports = router;