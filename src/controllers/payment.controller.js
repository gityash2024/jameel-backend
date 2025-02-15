// src/controllers/payment.controller.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const { sendEmail } = require('../services/email.service');
const { createNotification } = require('../services/notification.service');

exports.getPaymentMethods = catchAsync(async (req, res) => {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: req.user.stripeCustomerId,
    type: 'card'
  });

  res.status(200).json({
    status: 'success',
    data: {
      paymentMethods: paymentMethods.data
    }
  });
});

exports.addPaymentMethod = catchAsync(async (req, res, next) => {
  const { type, token } = req.body;

  // Get or create Stripe customer
  let customer;
  if (!req.user.stripeCustomerId) {
    customer = await stripe.customers.create({
      email: req.user.email,
      name: `${req.user.firstName} ${req.user.lastName}`,
      source: token
    });

    await User.findByIdAndUpdate(req.user._id, {
      stripeCustomerId: customer.id
    });
  } else {
    await stripe.customers.createSource(req.user.stripeCustomerId, {
      source: token
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Payment method added successfully'
  });
});

exports.removePaymentMethod = catchAsync(async (req, res, next) => {
  if (!req.user.stripeCustomerId) {
    return next(new AppError('No payment methods found', 404));
  }

  await stripe.paymentMethods.detach(req.params.id);

  res.status(200).json({
    status: 'success',
    message: 'Payment method removed successfully'
  });
});
// Gift card functions
exports.purchaseGiftCard = catchAsync(async (req, res, next) => {
  const { amount, recipientEmail, message } = req.body;

  // Implement gift card purchase logic here
  // ...

  res.status(201).json({
    status: 'success',
    data: {
      // Gift card data
    }
  });
});

exports.getMyGiftCards = catchAsync(async (req, res) => {
  // Implement logic to retrieve user's gift cards
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // User's gift cards
    }
  });
});

exports.redeemGiftCard = catchAsync(async (req, res, next) => {
  const { code } = req.body;

  // Implement gift card redemption logic here
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Redeemed gift card data
    }
  });
});

exports.checkGiftCardBalance = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Implement logic to check gift card balance
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Gift card balance
    }
  });
});

// Layaway functions
exports.setupLayaway = catchAsync(async (req, res, next) => {
  const { orderId, downPayment, duration } = req.body;

  // Implement layaway setup logic here
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Layaway data
    }
  });
});

exports.getLayawayDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Implement logic to retrieve layaway details
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Layaway details
    }
  });
});

exports.processLayawayPayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Implement layaway payment processing logic here
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Layaway payment data
    }
  });
});


// Payment administration functions
exports.getAllTransactions = catchAsync(async (req, res) => {
  // Implement logic to retrieve all transactions
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // All transactions
    }
  });
});

exports.getTransactionById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Implement logic to retrieve a specific transaction by ID
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Transaction details
    }
  });
});

exports.updateTransactionStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  // Implement logic to update transaction status
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Updated transaction
    }
  });
});

// Refund management functions
exports.getAllRefunds = catchAsync(async (req, res) => {
  // Implement logic to retrieve all refunds
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // All refunds
    }
  });
});

exports.getRefundById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Implement logic to retrieve a specific refund by ID
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Refund details
    }
  });
});

// Payment analytics functions
exports.getRevenueAnalytics = catchAsync(async (req, res) => {
  // Implement logic to retrieve revenue analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Revenue analytics
    }
  });
});

exports.getPaymentMethodAnalytics = catchAsync(async (req, res) => {
  // Implement logic to retrieve payment method analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Payment method analytics
    }
  });
});

exports.getRefundAnalytics = catchAsync(async (req, res) => {
  // Implement logic to retrieve refund analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Refund analytics
    }
  });
});

// Payment settings functions
exports.getPaymentSettings = catchAsync(async (req, res) => {
  // Implement logic to retrieve payment settings
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Payment settings
    }
  });
});

exports.updatePaymentSettings = catchAsync(async (req, res) => {
  const { supportedMethods, minimumAmount, maxRefundPeriod } = req.body;

  // Implement logic to update payment settings
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Updated payment settings
    }
  });
});

// Export functionality
exports.exportTransactions = catchAsync(async (req, res) => {
  // Implement logic to export transactions
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Exported transactions
    }
  });
});
exports.setDefaultPaymentMethod = catchAsync(async (req, res, next) => {
  if (!req.user.stripeCustomerId) {
    return next(new AppError('No payment methods found', 404));
  }

  await stripe.customers.update(req.user.stripeCustomerId, {
    default_source: req.params.id
  });

  res.status(200).json({
    status: 'success',
    message: 'Default payment method updated successfully'
  });
});

exports.processPayment = catchAsync(async (req, res, next) => {
  const { orderId, paymentMethodId, amount, currency = 'usd' } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    customer: req.user.stripeCustomerId,
    payment_method: paymentMethodId,
    confirm: true,
    return_url: `${process.env.FRONTEND_URL}/payment/confirm`,
    metadata: {
      orderId: order._id.toString(),
      userId: req.user._id.toString()
    }
  });

  // Create payment record
  const payment = await Payment.create({
    order: orderId,
    user: req.user._id,
    amount,
    currency,
    paymentMethod: 'card',
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status
  });

  // Update order payment status
  order.paymentStatus = paymentIntent.status === 'succeeded' ? 'paid' : 'processing';
  order.paymentIntentId = paymentIntent.id;
  await order.save();

  res.status(200).json({
    status: 'success',
    data: {
      payment,
      clientSecret: paymentIntent.client_secret
    }
  });
});

exports.confirmPayment = catchAsync(async (req, res, next) => {
  const { paymentIntentId } = req.body;

  const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
  const payment = await Payment.findOne({ paymentIntentId });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  payment.status = paymentIntent.status;
  await payment.save();

  // Update order status if payment successful
  if (paymentIntent.status === 'succeeded') {
    const order = await Order.findById(payment.order);
    order.paymentStatus = 'paid';
    await order.save();

    // Send payment confirmation
    await sendPaymentConfirmation(order, payment);
  }

  res.status(200).json({
    status: 'success',
    data: {
      payment
    }
  });
});

exports.handleWebhook = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle different event types
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
    case 'charge.refunded':
      await handleRefund(event.data.object);
      break;
  }

  res.json({ received: true });
});

exports.processRefund = catchAsync(async (req, res, next) => {
  const { paymentId, amount, reason } = req.body;

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  const refund = await stripe.refunds.create({
    payment_intent: payment.paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined,
    reason
  });

  payment.status = 'refunded';
  payment.refundId = refund.id;
  await payment.save();

  // Update order status
  const order = await Order.findById(payment.order);
  order.paymentStatus = 'refunded';
  order.refundAmount = amount || order.total;
  await order.save();

  // Send refund notification
  await sendRefundNotification(order, refund);

  res.status(200).json({
    status: 'success',
    data: {
      refund
    }
  });
});

exports.createPaymentPlan = catchAsync(async (req, res, next) => {
  const { orderId, numberOfInstallments, frequency } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const installmentAmount = Math.round((order.total / numberOfInstallments) * 100) / 100;

  const schedule = Array.from({ length: numberOfInstallments }, (_, i) => ({
    amount: installmentAmount,
    dueDate: calculateDueDate(i + 1, frequency)
  }));

  const paymentPlan = await PaymentPlan.create({
    order: orderId,
    user: req.user._id,
    installments: schedule,
    frequency,
    totalAmount: order.total,
    remainingAmount: order.total
  });

  res.status(201).json({
    status: 'success',
    data: {
      paymentPlan
    }
  });
});

exports.getPaymentPlan = catchAsync(async (req, res, next) => {
  const paymentPlan = await PaymentPlan.findById(req.params.id)
    .populate('order')
    .populate('user', 'firstName lastName email');

  if (!paymentPlan) {
    return next(new AppError('Payment plan not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      paymentPlan
    }
  });
});

exports.processInstallment = catchAsync(async (req, res, next) => {
  const { planId, installmentId, paymentMethodId } = req.body;

  const paymentPlan = await PaymentPlan.findById(planId);
  if (!paymentPlan) {
    return next(new AppError('Payment plan not found', 404));
  }

  const installment = paymentPlan.installments.id(installmentId);
  if (!installment || installment.status !== 'pending') {
    return next(new AppError('Invalid installment', 400));
  }

  // Process payment
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(installment.amount * 100),
    currency: 'usd',
    customer: req.user.stripeCustomerId,
    payment_method: paymentMethodId,
    confirm: true,
    metadata: {
      planId: paymentPlan._id.toString(),
      installmentId: installment._id.toString()
    }
  });

  // Update installment status
  installment.status = 'paid';
  installment.paidAt = Date.now();
  paymentPlan.remainingAmount -= installment.amount;
  await paymentPlan.save();

  res.status(200).json({
    status: 'success',
    data: {
      paymentPlan
    }
  });
});

// Helper Functions

const handlePaymentSuccess = async (paymentIntent) => {
  const { orderId } = paymentIntent.metadata;
  const order = await Order.findById(orderId);

  order.paymentStatus = 'paid';
  order.orderStatus = 'processing';
  await order.save();

  // Send payment success notification
  await sendPaymentConfirmation(order);
};

const handlePaymentFailure = async (paymentIntent) => {
  const { orderId } = paymentIntent.metadata;
  const order = await Order.findById(orderId);

  order.paymentStatus = 'failed';
  await order.save();

  // Send payment failure notification
  await createNotification(
    order.user,
    'payment',
    'Payment Failed',
    `Payment for order ${order.orderNumber} has failed. Please try again.`
  );
};

const handleRefund = async (charge) => {
  const payment = await Payment.findOne({ chargeId: charge.id });
  if (!payment) return;

  payment.status = 'refunded';
  await payment.save();

  const order = await Order.findById(payment.order);
  order.paymentStatus = 'refunded';
  await order.save();

  // Send refund notification
  await sendRefundNotification(order, charge);
};

const sendPaymentConfirmation = async (order, payment) => {
  // Send email
  await sendEmail(
    order.user.email,
    'Payment Confirmation',
    'payment-confirmation',
    {
      order,
      payment
    }
  );

  // Create notification
  await createNotification(
    order.user,
    'payment',
    'Payment Confirmed',
    `Payment for order ${order.orderNumber} has been confirmed`
  );
};

const sendRefundNotification = async (order, refund) => {
  // Send email
  await sendEmail(
    order.user.email,
    'Refund Processed',
    'refund-confirmation',
    {
      order,
      refund
    }
  );

  // Create notification
  await createNotification(
    order.user,
    'payment',
    'Refund Processed',
    `Refund for order ${order.orderNumber} has been processed`
  );
};

const calculateDueDate = (installmentNumber, frequency) => {
  const date = new Date();
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + (7 * installmentNumber));
      break;
    case 'biweekly':
      date.setDate(date.getDate() + (14 * installmentNumber));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + installmentNumber);
      break;
    default:
      throw new Error('Invalid frequency');
  }
  return date;
};