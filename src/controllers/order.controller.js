// src/controllers/order.controller.js
const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const Inventory = require('../models/inventory.model');
const Payment = require('../models/payment.model');
const { createPaymentIntent } = require('../services/payment.service');
const { sendEmail } = require('../services/email.service');
const { sendSms } = require('../services/sms.service');
const { createNotification } = require('../services/notification.service');
const { AppError, catchAsync } = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const axios = require('axios');

exports.createOrder = catchAsync(async (req, res, next) => {
  let cartItems = [];
  let orderTotal = 0;
  
  // Check if order items are provided directly in the request
  if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
    console.log('Creating order from request body items:', req.body.items);
    
    // Process items from request
    cartItems = req.body.items;
    orderTotal = req.body.total || 0;
  } else {
    // Get cart details
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product')
      .populate('items.variant');

    if (!cart || cart.items.length === 0) {
      return next(new AppError('Cart is empty', 400));
    }
    
    cartItems = cart.items;
    orderTotal = cart.total || req.body.total || 0;
    
    // Clear cart after successful order creation
    cart.items = [];
    cart.couponCode = null;
    cart.discount = 0;
    await cart.save();
  }

  // Validate inventory
  for (const item of cartItems) {
    if (!item.product || !item.product._id) {
      continue; // Skip if product is not available
    }
    
    const inventory = await Inventory.findOne({
      product: typeof item.product === 'object' ? item.product._id : item.product,
      variant: item.variant?._id || null
    });

    if (!inventory || inventory.quantity < item.quantity) {
      const productName = typeof item.product === 'object' ? item.product.name : 'Product';
      return next(new AppError(`Insufficient inventory for ${productName}`, 400));
    }
  }

  // Generate order number
  const orderNumber = await generateOrderNumber();

  // Create order
  let order;
  try {
    order = await Order.create({
      orderNumber,
      user: req.user._id,
      items: cartItems,
      shippingAddress: req.body.shippingAddress,
      billingAddress: req.body.billingAddress || req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      shippingMethod: req.body.shippingMethod,
      subTotal: req.body.subtotal || orderTotal,
      tax: req.body.tax || 0,
      shippingCost: req.body.shippingCost || 0,
      discount: req.body.discount || 0,
      total: orderTotal,
      couponCode: req.body.couponCode,
      notes: req.body.notes,
      isGift: req.body.isGift,
      giftMessage: req.body.giftMessage
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return next(new AppError('Failed to create order', 500));
  }

  // Update inventory
  for (const item of cartItems) {
    if (!item.product || !item.product._id) {
      continue; // Skip if product is not available
    }
    
    await Inventory.findOneAndUpdate(
      {
        product: typeof item.product === 'object' ? item.product._id : item.product,
        variant: item.variant?._id || null
      },
      {
        $inc: { quantity: -item.quantity }
      }
    );

    // Update product sales count
    const productId = typeof item.product === 'object' ? item.product._id : item.product;
    await Product.findByIdAndUpdate(productId, {
      $inc: { salesCount: item.quantity }
    });
  }

  // Create payment intent if needed
  let paymentIntent = null;
  if (req.body.paymentMethod !== 'cash_on_delivery') {
    try {
      // Create a payment intent with properly formatted metadata
      paymentIntent = await createPaymentIntent(
        Math.round(order.total * 100), // Amount in cents
        'usd',
        { orderId: order._id.toString() }
      );
      
      if (paymentIntent && paymentIntent.id) {
        order.paymentIntentId = paymentIntent.id;
        await order.save();
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      // Don't fail the entire order creation if payment intent fails
    }
  }

  // Handle coupon code if provided
  if (req.body.couponCode) {
    try {
      const couponResponse = await axios.post(`${process.env.BASE_URL}/api/v1/coupons/validate`, {
        code: req.body.couponCode,
        amount: order.subTotal
      });
      
      if (couponResponse.data && couponResponse.data.status === 'success') {
        const { coupon, discount } = couponResponse.data.data;
        
        // Apply discount
        order.discount = discount;
        order.coupon = {
          code: coupon.code,
          value: coupon.value,
          type: coupon.type,
          _id: coupon._id
        };
        
        // Increment coupon usage after successful order creation
        await axios.post(`${process.env.BASE_URL}/api/v1/coupons/increment-usage`, {
          code: coupon.code
        });
      }
    } catch (err) {
      console.error('Error applying coupon:', err.message);
      // Don't fail the order creation if coupon application fails
    }
  }

  // Calculate the final total AFTER any potential discount
  order.total = order.subTotal + order.tax + order.shippingCost - order.discount;

  // Send notifications
  try {
    await sendOrderConfirmationNotifications(order);
  } catch (error) {
    console.error('Error sending order notifications:', error);
    // Continue with order creation even if notifications fail
  }

  res.status(201).json({
    status: 'success',
    data: {
      order,
      clientSecret: paymentIntent ? paymentIntent.client_secret : null
    }
  });
});

exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order can be deleted (you might want to add your own business logic here)
  if (!['pending', 'cancelled'].includes(order.orderStatus)) {
    return next(new AppError('Only pending or cancelled orders can be deleted', 400));
  }

  // If order has been paid, process refund
  if (order.paymentStatus === 'paid') {
    await processRefund(order);
  }

  // Restore inventory if needed
  await restoreInventory(order);

  // Delete the order
  await order.deleteOne();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.updateRefundStatus = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const { status } = req.body;

  // Update refund status
  order.refundStatus = status;
  
  // If refund is completed, update order payment status
  if (status === 'completed') {
    order.paymentStatus = 'refunded';
    order.orderStatus = 'refunded';
  }

  await order.save();

  // Send notification
  await sendEmail(
    order.user.email,
    'Refund Status Updated',
    'refund-status-update',
    {
      order,
      user: order.user,
      status
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.getMyOrders = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Order.find({ user: req.user._id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const orders = await features.query;
  const total = await Order.countDocuments({ user: req.user._id });

  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    data: {
      orders
    }
  });
});

exports.verifyPayment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Verify payment status from payment service/gateway
  const paymentStatus = await verifyPaymentStatus(order.paymentIntentId);

  // Update order payment status
  order.paymentStatus = paymentStatus;
  if (paymentStatus === 'paid') {
    order.orderStatus = 'processing';
  }
  await order.save();

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.getMyOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!['pending', 'processing'].includes(order.orderStatus)) {
    return next(new AppError('Order cannot be cancelled at this stage', 400));
  }

  // Process cancellation
  order.orderStatus = 'cancelled';
  order.cancelReason = req.body.cancelReason;
  await order.save();

  // Restore inventory
  for (const item of order.items) {
    await Inventory.findOneAndUpdate(
      {
        product: item.product,
        variant: item.variant || null
      },
      {
        $inc: { quantity: item.quantity }
      }
    );

    // Update product sales count
    await Product.findByIdAndUpdate(item.product, {
      $inc: { salesCount: -item.quantity }
    });
  }

  // Process refund if payment was made
  if (order.paymentStatus === 'paid') {
    await processRefund(order);
  }

  // Send notifications
  await sendOrderCancellationNotifications(order);

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.processPayment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (order.paymentStatus === 'paid') {
    return next(new AppError('Order is already paid', 400));
  }

  const payment = await Payment.create({
    order: order._id,
    user: req.user._id,
    amount: order.total,
    paymentMethod: req.body.paymentMethod,
    paymentMethodId: req.body.paymentMethodId
  });

  order.paymentStatus = 'processing';
  await order.save();

  // Process payment based on method
  const paymentResult = await processPaymentByMethod(payment);

  res.status(200).json({
    status: 'success',
    data: {
      payment: paymentResult
    }
  });
});

exports.setupLayaway = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const { downPayment, numberOfInstallments } = req.body;

  if (downPayment <= 0 || downPayment >= order.total) {
    return next(new AppError('Invalid down payment amount', 400));
  }

  const installmentAmount = ((order.total - downPayment) / numberOfInstallments).toFixed(2);

  order.layaway = {
    isLayaway: true,
    downPayment,
    installments: Array.from({ length: numberOfInstallments }, (_, i) => ({
      amount: installmentAmount,
      dueDate: calculateInstallmentDueDate(i + 1),
      status: 'pending'
    }))
  };

  await order.save();

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.payLayawayInstallment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order || !order.layaway.isLayaway) {
    return next(new AppError('Layaway order not found', 404));
  }

  const installment = order.layaway.installments.id(req.body.installmentId);
  if (!installment || installment.status !== 'pending') {
    return next(new AppError('Invalid installment', 400));
  }

  // Process installment payment
  const payment = await Payment.create({
    order: order._id,
    user: req.user._id,
    amount: installment.amount,
    paymentMethod: req.body.paymentMethod,
    paymentMethodId: req.body.paymentMethodId
  });

  installment.status = 'paid';
  installment.paidAt = Date.now();
  await order.save();

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

// Admin Routes

exports.getAllOrders = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Order.find(),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const orders = await features.query
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'name sku');

  const total = await Order.countDocuments();

  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    data: {
      orders
    }
  });
});

exports.getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'name sku images')
    .populate('items.variant');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.updateOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  Object.assign(order, req.body);
  await order.save();

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const { status } = req.body;
  const oldStatus = order.orderStatus;
  order.orderStatus = status;

  if (status === 'delivered') {
    order.actualDeliveryDate = new Date();
  }

  await order.save();

  // Handle status-specific actions
  await handleOrderStatusChange(order, oldStatus, status);

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.updateShipping = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  order.trackingNumber = req.body.trackingNumber;
  order.estimatedDeliveryDate = req.body.estimatedDeliveryDate;
  order.orderStatus = 'shipped';
  await order.save();

  // Send shipping notification
  await sendShippingNotifications(order);

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.processRefund = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (order.paymentStatus !== 'paid') {
    return next(new AppError('Order payment status must be paid to process refund', 400));
  }

  const refund = await processRefund(order, req.body.amount, req.body.reason);

  res.status(200).json({
    status: 'success',
    data: {
      refund
    }
  });
});

exports.exportOrdersCsv = catchAsync(async (req, res) => {
  const orders = await Order.find(req.query)
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'name sku');

  const csv = await generateOrdersCsv(orders);

  res.attachment('orders.csv');
  res.status(200).send(csv);
});

exports.generateOrderInvoice = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'name sku');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const invoice = await generateInvoicePdf(order);

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);
  res.status(200).send(invoice);
});

// Analytics Routes

exports.getOrderAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const analytics = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 },
        revenue: { $sum: '$total' }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

// Continuing from previous implementation...

exports.getSalesAnalytics = catchAsync(async (req, res) => {
    const { startDate, endDate, interval = 'day' } = req.query;
  
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          orderStatus: { $nin: ['cancelled', 'refunded'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === 'month' ? '%Y-%m' : '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          items: { $sum: { $size: '$items' } },
          averageOrderValue: { $avg: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  
    res.status(200).json({
      status: 'success',
      data: {
        salesData
      }
    });
  });
  
  // Helper Functions
  
  const generateOrderNumber = async () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const count = await Order.countDocuments() + 1;
    return `ORD-${year}${month}-${count.toString().padStart(4, '0')}`;
  };
  
  const sendOrderConfirmationNotifications = async (order) => {
    try {
      // Skip email if user email isn't available
      if (order.user && order.user.email) {
        // Send email notification
        await sendEmail(
          order.user.email,
          'Order Confirmation',
          'order-confirmation',
          {
            order,
            user: order.user
          }
        );
      }
    
      // Send SMS if phone number exists
      if (order.user && order.user.phone) {
        try {
          await sendSms(
            order.user.phone,
            `Your order #${order.orderNumber} has been confirmed. Thank you for shopping with us!`
          );
        } catch (error) {
          console.error('Error sending SMS:', error);
          // Continue execution even if SMS fails
        }
      }
    
      // Create in-app notification
      if (order.user && order.user._id) {
        try {
          await createNotification(
            order.user._id,
            'order',
            'Order Confirmation',
            `Your order #${order.orderNumber} has been confirmed`
          );
        } catch (error) {
          console.error('Error creating notification:', error);
          // Continue execution even if notification fails
        }
      }
    } catch (error) {
      console.error('Error sending order notifications:', error);
      // Notifications shouldn't block order creation
    }
  };
  
  const sendOrderCancellationNotifications = async (order) => {
    try {
      // Skip email if user email isn't available
      if (order.user && order.user.email) {
        // Send email notification
        await sendEmail(
          order.user.email,
          'Order Cancelled',
          'order-cancellation',
          {
            order,
            user: order.user
          }
        );
      }
    
      // Send SMS if phone number exists
      if (order.user && order.user.phone) {
        try {
          await sendSms(
            order.user.phone,
            `Your order #${order.orderNumber} has been cancelled`
          );
        } catch (error) {
          console.error('Error sending cancellation SMS:', error);
        }
      }
    
      // Create in-app notification
      if (order.user && order.user._id) {
        try {
          await createNotification(
            order.user._id,
            'order',
            'Order Cancelled',
            `Your order #${order.orderNumber} has been cancelled`
          );
        } catch (error) {
          console.error('Error creating cancellation notification:', error);
        }
      }
    } catch (error) {
      console.error('Error sending cancellation notifications:', error);
    }
  };
  
  const sendShippingNotifications = async (order) => {
    try {
      // Skip email if user email isn't available
      if (order.user && order.user.email) {
        // Send email notification
        await sendEmail(
          order.user.email,
          'Order Shipped',
          'order-shipped',
          {
            order,
            user: order.user,
            trackingUrl: generateTrackingUrl(order.trackingNumber)
          }
        );
      }
    
      // Send SMS if phone number exists
      if (order.user && order.user.phone) {
        try {
          await sendSms(
            order.user.phone,
            `Your order #${order.orderNumber} has been shipped. Track your package: ${generateTrackingUrl(order.trackingNumber)}`
          );
        } catch (error) {
          console.error('Error sending shipping SMS:', error);
        }
      }
    
      // Create in-app notification
      if (order.user && order.user._id) {
        try {
          await createNotification(
            order.user._id,
            'order',
            'Order Shipped',
            `Your order #${order.orderNumber} has been shipped`
          );
        } catch (error) {
          console.error('Error creating shipping notification:', error);
        }
      }
    } catch (error) {
      console.error('Error sending shipping notifications:', error);
    }
  };
  
  const processRefund = async (order, amount = null, reason = '') => {
    const refundAmount = amount || order.total;
  
    // Process refund through payment service
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentIntentId,
      amount: Math.round(refundAmount * 100)
    });
  
    // Update order status
    order.orderStatus = 'refunded';
    order.paymentStatus = 'refunded';
    order.refundAmount = refundAmount;
    order.refundReason = reason;
    await order.save();
  
    // Send refund notification
    await sendEmail(
      order.user.email,
      'Refund Processed',
      'order-refund',
      {
        order,
        user: order.user,
        refundAmount
      }
    );
  
    return refund;
  };
  
  const handleOrderStatusChange = async (order, oldStatus, newStatus) => {
    switch (newStatus) {
      case 'processing':
        // Send processing notification
        await createNotification(
          order.user._id,
          'order',
          'Order Processing',
          `Your order #${order.orderNumber} is being processed`
        );
        break;
  
      case 'shipped':
        // Send shipping notification
        await sendShippingNotifications(order);
        break;
  
      case 'delivered':
        // Send delivery confirmation
        await sendEmail(
          order.user.email,
          'Order Delivered',
          'order-delivered',
          {
            order,
            user: order.user
          }
        );
        
        // Create review request notification after delivery
        await createNotification(
          order.user._id,
          'review_request',
          'Review Your Purchase',
          `How was your experience with order #${order.orderNumber}?`
        );
        break;
  
      case 'cancelled':
        // Restore inventory if cancelled
        await restoreInventory(order);
        await sendOrderCancellationNotifications(order);
        break;
    }
  };
  
  const restoreInventory = async (order) => {
    for (const item of order.items) {
      await Inventory.findOneAndUpdate(
        {
          product: item.product,
          variant: item.variant || null
        },
        {
          $inc: { quantity: item.quantity }
        }
      );
    }
  };
  
  const generateOrdersCsv = async (orders) => {
    const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
    
    const csvStringifier = createCsvStringifier({
      header: [
        { id: 'orderNumber', title: 'Order Number' },
        { id: 'date', title: 'Date' },
        { id: 'customer', title: 'Customer' },
        { id: 'total', title: 'Total' },
        { id: 'status', title: 'Status' },
        { id: 'paymentStatus', title: 'Payment Status' }
      ]
    });
  
    const records = orders.map(order => ({
      orderNumber: order.orderNumber,
      date: order.createdAt.toISOString(),
      customer: `${order.user.firstName} ${order.user.lastName}`,
      total: order.total.toFixed(2),
      status: order.orderStatus,
      paymentStatus: order.paymentStatus
    }));
  
    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  };
  
  const generateInvoicePdf = async (order) => {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const buffers = [];
  
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      return pdfData;
    });
  
    // Add invoice content
    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order Number: ${order.orderNumber}`);
    doc.text(`Date: ${order.createdAt.toLocaleDateString()}`);
    doc.moveDown();
    
    // Add items
    order.items.forEach(item => {
      doc.text(`${item.product.name} x ${item.quantity} - $${item.total.toFixed(2)}`);
    });
  
    doc.moveDown();
    doc.text(`Total: $${order.total.toFixed(2)}`);
    
    doc.end();
    
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  };
  
  const calculateInstallmentDueDate = (installmentNumber) => {
    const date = new Date();
    date.setMonth(date.getMonth() + installmentNumber);
    return date;
  };
  
  const generateTrackingUrl = (trackingNumber) => {
    // Implement based on shipping carrier
    return `${process.env.SHIPPING_TRACKING_URL}/${trackingNumber}`;
  };