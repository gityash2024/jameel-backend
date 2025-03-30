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
const User = require('../models/user.model');
const { sendOrderConfirmationEmail, sendShippingNotification } = require('../utils/emailService');
const fedexService = require('../utils/fedexService');
const Review = require('../models/review.model');

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

const updateShipping = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      trackingNumber, 
      serviceType, 
      estimatedDeliveryDate,
      status,
      packageDetails 
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Find the order
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Initialize shipping object if it doesn't exist
    if (!order.shipping) {
      order.shipping = {};
    }

    // Check if we're adding a new tracking number
    const isNewTracking = trackingNumber && trackingNumber !== order.shipping.trackingNumber;

    // Update shipping fields if provided
    if (trackingNumber) {
      order.shipping.trackingNumber = trackingNumber;
      
      try {
        // Generate tracking URL using FedEx tracking URL
        order.shipping.trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
        
        // If this is a new tracking number, update the order status to shipped
        if (isNewTracking) {
          order.shipping.shippedAt = new Date();
          
          // Only update order status if it's not already delivered
          if (order.orderStatus !== 'delivered') {
            order.orderStatus = 'shipped';
          }
          
          // Get initial tracking details from FedEx if possible
          try {
            const trackingData = await fedexService.trackShipment(trackingNumber);
            if (trackingData.estimatedDelivery) {
              order.shipping.estimatedDeliveryDate = trackingData.estimatedDelivery;
            }
          } catch (trackingError) {
            console.error('Could not fetch initial tracking data:', trackingError.message);
            // Continue with the update even if tracking fails
          }
        }
      } catch (error) {
        console.error('Error generating tracking URL:', error);
        // Continue with the update even if URL generation fails
      }
    }

    if (serviceType) {
      order.shipping.serviceType = serviceType;
    }

    if (estimatedDeliveryDate) {
      order.shipping.estimatedDeliveryDate = estimatedDeliveryDate;
    }
    
    if (status) {
      order.shipping.status = status;
      
      // Sync order status with shipping status when applicable
      switch (status) {
        case 'delivered':
          order.orderStatus = 'delivered';
          order.shipping.deliveredAt = new Date();
          break;
        case 'picked_up':
          if (order.orderStatus !== 'delivered') {
            order.orderStatus = 'shipped';
          }
          break;
        case 'in_transit':
          if (order.orderStatus !== 'delivered') {
            order.orderStatus = 'shipped';
          }
          break;
        case 'out_for_delivery':
          if (order.orderStatus !== 'delivered') {
            order.orderStatus = 'out_for_delivery';
          }
          break;
      }
    }
    
    if (packageDetails) {
      order.shipping.packageDetails = packageDetails;
    }

    // Save the updated order
    await order.save();

    // Send shipping notification if adding new tracking
    if (isNewTracking) {
      try {
        // Get user email
        const user = await User.findById(order.user);
        if (user && user.email) {
          await sendShippingNotification(
            user.email,
            {
              orderNumber: order.orderNumber,
              trackingNumber: order.shipping.trackingNumber,
              trackingUrl: order.shipping.trackingUrl,
              estimatedDelivery: order.shipping.estimatedDeliveryDate
            }
          );
        }
      } catch (emailError) {
        console.error('Failed to send shipping notification:', emailError);
        // Continue with the response even if email fails
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Shipping information updated successfully',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Error updating shipping information:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update shipping information',
      error: error.message
    });
  }
};

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

const trackShipment = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    
    // Check if order has tracking information
    if (!order.shipping || !order.shipping.trackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'No tracking information available for this order',
      });
    }
    
    // Get tracking information from FedEx service
    try {
      // Import the FedEx service properly
      const FedExService = require('../utils/fedexService');
      const fedexServiceInstance = new FedExService();
      
      // Try to get real tracking data from FedEx
      const trackingData = await fedexServiceInstance.trackShipment(order.shipping.trackingNumber);
      
      return res.status(200).json({
        success: true,
        message: 'Tracking information retrieved successfully',
        data: trackingData,
      });
      
    } catch (fedexError) {
      console.error('FedEx Tracking Error:', fedexError.message);
      
      // If we can't get tracking from FedEx, return basic information based on order status
      return res.status(200).json({
        success: true,
        message: 'Basic tracking information retrieved',
        data: {
          trackingNumber: order.shipping.trackingNumber,
          status: order.orderStatus,
          statusDetails: `Order is currently ${order.orderStatus.replace('_', ' ')}`,
          estimatedDelivery: order.shipping.estimatedDeliveryDate,
          lastUpdated: new Date().toISOString(),
          trackingHistory: [
            {
              timestamp: order.shipping.shippedAt || order.updatedAt,
              status: 'SHIPPED',
              statusDetails: 'Order has been shipped',
              location: 'Shipping Origin',
            }
          ],
        },
      });
    }
    
  } catch (error) {
    console.error('Error tracking shipment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tracking information',
      error: error.message,
    });
  }
};

exports.getDashboardStats = catchAsync(async (req, res, next) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Get order stats by status
    const orderStatusCounts = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Calculate total orders
    const totalOrders = await Order.countDocuments();
    
    // Process order status counts
    const orderStats = {
      pending: 0,
      processing: 0,
      shipped: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
      total: totalOrders
    };
    
    orderStatusCounts.forEach(status => {
      if (status._id === 'pending') orderStats.pending = status.count;
      if (status._id === 'processing') orderStats.processing = status.count;
      if (status._id === 'shipped') orderStats.shipped = status.count;
      if (status._id === 'out_for_delivery') orderStats.outForDelivery = status.count;
      if (status._id === 'delivered') orderStats.delivered = status.count;
      if (status._id === 'cancelled') orderStats.cancelled = status.count;
    });
    
    // Get revenue data
    const totalRevenue = await Order.aggregate([
      {
        $match: {
          orderStatus: { $nin: ['cancelled', 'refunded'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" }
        }
      }
    ]);
    
    const todayRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfToday },
          orderStatus: { $nin: ['cancelled', 'refunded'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" }
        }
      }
    ]);
    
    const weekRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek },
          orderStatus: { $nin: ['cancelled', 'refunded'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" }
        }
      }
    ]);
    
    const monthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          orderStatus: { $nin: ['cancelled', 'refunded'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" }
        }
      }
    ]);
    
    // Get monthly revenue for the year
    const revenueByMonth = await Order.aggregate([
      {
        $match: {
          orderStatus: { $nin: ['cancelled', 'refunded'] },
          createdAt: { 
            $gte: new Date(new Date().getFullYear(), 0, 1) // Start of current year
          }
        }
      },
      {
        $group: {
          _id: { 
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          revenue: { $sum: "$total" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);
    
    // Format revenue by month for chart
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedRevenueByMonth = months.map((month, index) => {
      const entry = revenueByMonth.find(r => r._id.month === index + 1);
      return {
        month: `${month} ${new Date().getFullYear().toString().slice(-2)}`,
        revenue: entry ? parseFloat(entry.revenue.toFixed(2)) : 0
      };
    });
    
    // Get product statistics
    const productStats = await Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          outOfStock: {
            $sum: {
              $cond: [{ $eq: ["$stockQuantity", 0] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    // Get user statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          newThisMonth: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", startOfMonth] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    // Get top categories
    const topCategories = await Order.aggregate([
      {
        $match: {
          orderStatus: { $nin: ['cancelled', 'refunded'] }
        }
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails"
        }
      },
      { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$categoryDetails.name",
          orders: { $sum: 1 },
          earning: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      {
        $sort: { earning: -1 }
      },
      {
        $limit: 6
      }
    ]);
    
    // Get recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(7)
      .populate('user', 'firstName lastName')
      .lean();
    
    const formattedRecentOrders = recentOrders.map(order => ({
      number: order.orderNumber,
      date: new Date(order.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      name: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'john due',
      amount: parseFloat(order.total.toFixed(2)),
      status: order.orderStatus.toUpperCase()
    }));
    
    // Get stock items
    const stockItems = await Product.find()
      .sort({ stockQuantity: 1 })
      .limit(8)
      .select('name stockQuantity images')
      .lean();
    
    const formattedStockItems = stockItems.map(product => ({
      name: product.name,
      quantity: product.stockQuantity,
      status: product.stockQuantity === 0 ? 'Out Of Stock' : 'In Stock',
      image: product.images && product.images.length > 0 ? product.images[0].url : ''
    }));
    
    // Get recent reviews
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('product', 'name images')
      .populate('user', 'firstName lastName')
      .lean();
    
    const formattedReviews = reviews.map(review => ({
      product: review.product ? review.product.name : '',
      user: review.user ? `${review.user.firstName} ${review.user.lastName}` : 'john due',
      rating: review.rating,
      image: review.product && review.product.images && review.product.images.length > 0 
        ? review.product.images[0].url : ''
    }));
    
    // Return complete dashboard stats
    res.status(200).json({
      status: 'success',
      data: {
        orderStats,
        revenue: {
          total: totalRevenue[0]?.total || 0,
          today: todayRevenue[0]?.total || 0,
          thisWeek: weekRevenue[0]?.total || 0,
          thisMonth: monthRevenue[0]?.total || 0
        },
        products: {
          total: productStats[0]?.total || 0,
          outOfStock: productStats[0]?.outOfStock || 0
        },
        users: {
          total: userStats[0]?.total || 0,
          newThisMonth: userStats[0]?.newThisMonth || 0
        },
        revenueByMonth: formattedRevenueByMonth,
        topCategories: topCategories.map(cat => ({
          name: cat._id || 'Uncategorized',
          orders: cat.orders,
          earning: parseFloat(cat.earning.toFixed(2))
        })),
        recentOrders: formattedRecentOrders,
        stockItems: formattedStockItems,
        reviews: formattedReviews
      }
    });
  } catch (error) {
    console.error('Error generating dashboard stats:', error);
    return next(new AppError('Failed to generate dashboard statistics', 500));
  }
});

// Collect all exports at the end of the file
module.exports = {
  createOrder: exports.createOrder,
  deleteOrder: exports.deleteOrder,
  updateRefundStatus: exports.updateRefundStatus,
  getMyOrders: exports.getMyOrders,
  verifyPayment: exports.verifyPayment,
  getMyOrderById: exports.getMyOrderById,
  cancelOrder: exports.cancelOrder,
  processPayment: exports.processPayment,
  setupLayaway: exports.setupLayaway,
  payLayawayInstallment: exports.payLayawayInstallment,
  getAllOrders: exports.getAllOrders,
  getOrderById: exports.getOrderById,
  updateOrder: exports.updateOrder,
  updateOrderStatus: exports.updateOrderStatus,
  processRefund: exports.processRefund,
  exportOrdersCsv: exports.exportOrdersCsv,
  generateOrderInvoice: exports.generateOrderInvoice,
  getOrderAnalytics: exports.getOrderAnalytics,
  getSalesAnalytics: exports.getSalesAnalytics,
  updateShipping,
  trackShipment,
  getDashboardStats: exports.getDashboardStats
};