// src/controllers/payment.controller.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const { sendEmail } = require('../services/email.service');
const { createNotification } = require('../services/notification.service');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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
  const { orderId, paymentMethodId, amount, currency } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    customer: req.user.stripeCustomerId,
    payment_method: paymentMethodId,
    confirm: true,
    return_url: `${process.env.FRONTEND_URL}/checkout/success`
  });

  const payment = await Payment.create({
    order: orderId,
    user: req.user._id,
    amount,
    currency,
    paymentMethodId,
    stripePaymentIntentId: paymentIntent.id,
    status: paymentIntent.status
  });

  if (paymentIntent.status === 'succeeded') {
    await handlePaymentSuccess(paymentIntent);
  } else if (paymentIntent.status === 'requires_action') {
    return res.status(200).json({
      status: 'action_required',
      clientSecret: paymentIntent.client_secret
    });
  }

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
  const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  payment.status = paymentIntent.status;
  await payment.save();

  if (paymentIntent.status === 'succeeded') {
    await handlePaymentSuccess(paymentIntent);
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
    payment_intent: payment.stripePaymentIntentId,
    amount: Math.round(amount * 100), // Convert to cents
    reason
  });

  payment.status = 'refunded';
  payment.refundId = refund.id;
  payment.refundAmount = amount;
  payment.refundReason = reason;
  await payment.save();

  await handleRefund(refund);

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

const generateInvoice = async (payment, order, user) => {
  const doc = new PDFDocument();
  const invoicePath = path.join(__dirname, `../temp/invoice-${payment._id}.pdf`);
  const writeStream = fs.createWriteStream(invoicePath);

  return new Promise((resolve, reject) => {
    doc.pipe(writeStream);

    // Add header
    doc.fontSize(20).text('JSK Jewelry', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('Invoice', { align: 'center' });
    doc.moveDown();

    // Add invoice details
    doc.fontSize(12);
    doc.text(`Invoice Number: ${payment._id}`);
    doc.text(`Order Number: ${order.orderNumber}`);
    doc.text(`Date: ${new Date(payment.createdAt).toLocaleDateString()}`);
    doc.moveDown();

    // Add customer details
    doc.text('Bill To:');
    doc.text(user.firstName + ' ' + user.lastName);
    doc.text(user.email);
    doc.text(order.shippingAddress.address);
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`);
    doc.moveDown();

    // Add items table
    doc.text('Items:', { underline: true });
    doc.moveDown();

    order.items.forEach(item => {
      doc.text(`${item.product.name} x ${item.quantity}`);
      doc.text(`Price: $${item.product.price.toFixed(2)}`, { align: 'right' });
      doc.moveDown(0.5);
    });

    doc.moveDown();

    // Add totals
    const subtotal = order.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const shipping = order.shippingCost || 0;
    const total = subtotal + shipping;

    doc.text('Subtotal: ' + `$${subtotal.toFixed(2)}`, { align: 'right' });
    doc.text('Shipping: ' + `$${shipping.toFixed(2)}`, { align: 'right' });
    doc.text('Total: ' + `$${total.toFixed(2)}`, { align: 'right', bold: true });

    // Add payment details
    doc.moveDown();
    doc.text('Payment Information:', { underline: true });
    doc.text(`Payment Method: ${payment.paymentMethod}`);
    doc.text(`Payment Status: ${payment.paymentStatus}`);
    if (payment.cardBrand && payment.cardLast4) {
      doc.text(`Card: ${payment.cardBrand} **** ${payment.cardLast4}`);
    }
    doc.text(`Transaction ID: ${payment.transactionId || payment.paymentIntentId}`);

    // Add footer
    doc.moveDown(2);
    doc.fontSize(10).text('Thank you for shopping with JSK Jewelry!', { align: 'center' });

    doc.end();

    writeStream.on('finish', () => {
      resolve(invoicePath);
    });

    writeStream.on('error', reject);
  });
};

const sendPaymentConfirmation = async (order, payment) => {
  try {
    const user = await User.findById(order.user);
    const invoicePath = await generateInvoice(payment, order, user);

    // Send email with invoice
    await sendEmail(
      user.email,
      'Payment Confirmation - JSK Jewelry',
      'payment-confirmation',
      {
        order,
        user,
        payment
      },
      [{
        filename: `invoice-${payment._id}.pdf`,
        path: invoicePath
      }]
    );

    // Delete the temporary invoice file
    fs.unlink(invoicePath, (err) => {
      if (err) console.error('Error deleting invoice file:', err);
    });
  } catch (error) {
    console.error('Error sending payment confirmation:', error);
    throw error;
  }
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

exports.getInvoice = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate({
      path: 'order',
      populate: {
        path: 'items.product',
        select: 'name images price'
      }
    })
    .populate('user', 'firstName lastName email');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  if (!payment.order) {
    return next(new AppError('Order associated with this payment not found', 404));
  }

  // Generate the invoice
  const doc = new PDFDocument({ margin: 50 });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=invoice-${payment._id}.pdf`);
  
  // Pipe the PDF to the response
  doc.pipe(res);
  
  // Add company logo
  // doc.image('path/to/logo.png', 50, 45, { width: 50 });
  
  // Add invoice title
  doc.fontSize(25).text('Invoice', 50, 50);
  
  // Add invoice details
  doc.fontSize(10)
     .text(`Invoice Number: ${payment._id}`, 50, 100)
     .text(`Date: ${new Date(payment.createdAt).toLocaleDateString()}`, 50, 115)
     .text(`Status: ${payment.status}`, 50, 130);
  
  // Add customer information
  doc.text('Customer:', 300, 100)
     .text(`${payment.user ? payment.user.firstName + ' ' + payment.user.lastName : 'Guest User'}`, 300, 115)
     .text(`${payment.user ? payment.user.email : 'N/A'}`, 300, 130);
  
  // Add order items table
  doc.moveDown(2);
  let y = doc.y;
  doc.fontSize(12).text('Items', 50, y);
  doc.moveDown();
  
  // Table headers
  y = doc.y;
  doc.fontSize(10)
     .text('Product', 50, y)
     .text('Quantity', 250, y)
     .text('Price', 350, y)
     .text('Total', 450, y);
  
  doc.moveDown();
  y = doc.y;
  
  // Draw a line
  doc.strokeColor('#aaaaaa')
     .lineWidth(1)
     .moveTo(50, y - 5)
     .lineTo(550, y - 5)
     .stroke();
  
  // Add order items
  let totalAmount = 0;
  payment.order.items.forEach((item, i) => {
    const itemTotal = item.price * item.quantity;
    totalAmount += itemTotal;
    
    y = doc.y + 15;
    doc.fontSize(10)
       .text(item.product ? item.product.name : 'Product', 50, y)
       .text(item.quantity.toString(), 250, y)
       .text(`$${item.price.toFixed(2)}`, 350, y)
       .text(`$${itemTotal.toFixed(2)}`, 450, y);
    
    doc.moveDown();
  });
  
  // Draw a line
  y = doc.y + 10;
  doc.strokeColor('#aaaaaa')
     .lineWidth(1)
     .moveTo(50, y)
     .lineTo(550, y)
     .stroke();
  
  // Add total amount
  y = doc.y + 20;
  doc.fontSize(12)
     .text('Subtotal:', 350, y)
     .text(`$${totalAmount.toFixed(2)}`, 450, y);
  
  y = doc.y + 15;
  doc.text('Shipping:', 350, y)
     .text(`$${payment.order.shippingCost ? payment.order.shippingCost.toFixed(2) : '0.00'}`, 450, y);
  
  y = doc.y + 15;
  const tax = payment.order.tax || 0;
  doc.text('Tax:', 350, y)
     .text(`$${tax.toFixed(2)}`, 450, y);
  
  y = doc.y + 15;
  const discount = payment.order.discount || 0;
  doc.text('Discount:', 350, y)
     .text(`-$${discount.toFixed(2)}`, 450, y);
  
  // Final total
  y = doc.y + 20;
  doc.fontSize(14)
     .text('Total:', 350, y, { bold: true })
     .text(`$${payment.amount.toFixed(2)}`, 450, y, { bold: true });
  
  // Add footer
  const footerY = doc.page.height - 100;
  doc.fontSize(10)
     .text('Thank you for your business!', 50, footerY)
     .text('For any questions, please contact support@jskjewelry.com', 50, footerY + 15);
  
  // Finalize the PDF
  doc.end();
});

// Get all payments
exports.getPayments = catchAsync(async (req, res) => {
  const payments = await Payment.find()
    .populate({
      path: 'order',
      select: 'orderNumber total items shippingAddress user'
    })
    .populate({
      path: 'user',
      select: 'firstName lastName email'
    })
    .sort({ createdAt: -1 });

  // Format the payments data for the frontend
  const formattedPayments = payments.map(payment => {
    return {
      _id: payment._id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      orderId: payment.order?._id,
      orderNumber: payment.order?.orderNumber,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      customer: {
        name: payment.user 
          ? `${payment.user.firstName || ''} ${payment.user.lastName || ''}`.trim() 
          : (payment.order?.shippingAddress 
              ? `${payment.order.shippingAddress.firstName || ''} ${payment.order.shippingAddress.lastName || ''}`.trim()
              : 'Guest User'),
        email: payment.user?.email || (payment.order?.shippingAddress?.email || 'N/A')
      }
    };
  });

  res.status(200).json({
    status: 'success',
    data: {
      payments: formattedPayments
    }
  });
});

// Get single payment
exports.getPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate('order')
    .populate('user', 'firstName lastName email');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      payment
    }
  });
});

// Create a payment intent for an order
exports.createPaymentIntentForOrder = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;
  
  if (!orderId) {
    return next(new AppError('Order ID is required', 400));
  }
  
  // Find the order
  const order = await Order.findById(orderId);
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Make sure amount is in cents
  const amount = Math.round(order.total * 100);
  
  try {
    // Create the payment intent with properly formatted metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber || 'N/A'
      }
    });
    
    // Update the order with the payment intent ID
    order.paymentIntentId = paymentIntent.id;
    await order.save();
    
    res.status(200).json({
      status: 'success',
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    return next(new AppError(`Payment processing error: ${error.message}`, 400));
  }
});