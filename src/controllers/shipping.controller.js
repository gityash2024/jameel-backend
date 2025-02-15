// src/controllers/shipping.controller.js
const Shipping = require('../models/shipping.model');
const Order = require('../models/order.model');
const Inventory = require('../models/inventory.model');
const { sendEmail } = require('../services/email.service');
const { createNotification } = require('../services/notification.service');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.calculateShippingRates = catchAsync(async (req, res, next) => {
  const { items, address } = req.body;

  // Get total weight and dimensions of items
  const weightAndDimensions = await calculateWeightAndDimensions(items);

  // Find applicable shipping method based on address and cart
  const shippingMethod = await Shipping.findOne({
    'zones.countries': address.country,
    'zones.states': address.state,
    minWeight: { $lte: weightAndDimensions.totalWeight },
    maxWeight: { $gte: weightAndDimensions.totalWeight }
  });

  if (!shippingMethod) {
    return next(new AppError('No shipping method available for this order', 400));
  }

  // Calculate shipping cost
  const shippingCost = await calculateShippingCost(
    shippingMethod,
    weightAndDimensions,
    items
  );

  res.status(200).json({
    status: 'success',
    data: {
      shippingMethod,
      shippingCost
    }
  });
});

exports.getShippingMethods = catchAsync(async (req, res) => {
  const shippingMethods = await Shipping.find({ isActive: true })
    .select('-__v');

  res.status(200).json({
    status: 'success',
    results: shippingMethods.length,
    data: {
      shippingMethods
    }
  });
});

exports.getSupportedCountries = catchAsync(async (req, res) => {
  const countries = await Shipping.aggregate([
    { $unwind: '$zones' },
    {
      $group: {
        _id: null,
        countries: { $addToSet: '$zones.countries' }
      }
    },
    { $project: { _id: 0, countries: 1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      countries: countries[0].countries
    }
  });
});

exports.trackShipment = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    trackingNumber: req.params.trackingNumber
  });

  if (!order) {
    return next(new AppError('Invalid tracking number', 404));
  }

  // Get tracking details from shipping carrier API
  const trackingDetails = await getTrackingDetails(order.trackingNumber);

  res.status(200).json({
    status: 'success',
    data: {
      trackingDetails
    }
  });
});

exports.getMyShipments = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Order.find({ 
      user: req.user._id,
      orderStatus: 'shipped'
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const shipments = await features.query;

  res.status(200).json({
    status: 'success',
    results: shipments.length,
    data: {
      shipments
    }
  });
});

exports.getShipmentById = catchAsync(async (req, res, next) => {
  const shipment = await Order.findOne({
    _id: req.params.id,
    user: req.user._id,
    orderStatus: 'shipped'
  });

  if (!shipment) {
    return next(new AppError('Shipment not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      shipment
    }
  });
});

// Admin Routes

exports.createShippingMethod = catchAsync(async (req, res) => {
  const shippingMethod = await Shipping.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      shippingMethod
    }
  });
});

exports.updateShippingMethod = catchAsync(async (req, res, next) => {
  const shippingMethod = await Shipping.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!shippingMethod) {
    return next(new AppError('Shipping method not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      shippingMethod
    }
  });
});

exports.deleteShippingMethod = catchAsync(async (req, res, next) => {
  const shippingMethod = await Shipping.findByIdAndDelete(req.params.id);

  if (!shippingMethod) {
    return next(new AppError('Shipping method not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createShippingZone = catchAsync(async (req, res) => {
  const shippingZone = await Shipping.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      shippingZone
    }
  });
});

exports.updateShippingZone = catchAsync(async (req, res, next) => {
  const shippingZone = await Shipping.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!shippingZone) {
    return next(new AppError('Shipping zone not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      shippingZone
    }
  });
});

exports.deleteShippingZone = catchAsync(async (req, res, next) => {
  const shippingZone = await Shipping.findByIdAndDelete(req.params.id);

  if (!shippingZone) {
    return next(new AppError('Shipping zone not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getAllShipments = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Order.find({ orderStatus: 'shipped' }),
    req.query  
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const shipments = await features.query;

  res.status(200).json({
    status: 'success',
    results: shipments.length,
    data: {
      shipments  
    }
  });
});

exports.createShipment = catchAsync(async (req, res, next) => {
  const { orderId, method, address } = req.body;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Validate items stock
  for (const item of order.items) {
    const inventory = await Inventory.findOne({
      product: item.product,
      variant: item.variant || null
    });

    if (inventory.quantity < item.quantity) {
      return next(
        new AppError(`Insufficient stock for product: ${item.product}`, 400)
      );
    }
  }

  // Update inventory
  for (const item of order.items) {
    await Inventory.findOneAndUpdate(
      {
        product: item.product,
        variant: item.variant || null  
      },
      {
        $inc: { quantity: -item.quantity }
      }
    );
  }

  const shippingMethod = await Shipping.findOne({ name: method });

  if (!shippingMethod) {
    return next(new AppError('Invalid shipping method', 400));
  }

  // Generate tracking number  
  const trackingNumber = await generateTrackingNumber();

  order.shippingAddress = address;
  order.shippingMethod = method;
  order.trackingNumber = trackingNumber;
  order.orderStatus = 'shipped';

  const updatedOrder = await order.save();

  // Send notifications
  await sendShippingNotifications(updatedOrder);

  res.status(200).json({
    status: 'success',
    data: {
      order: updatedOrder 
    }
  });
});

exports.updateShipment = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      trackingNumber: req.body.trackingNumber,
      estimatedDeliveryDate: req.body.estimatedDeliveryDate  
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!order) {
    return next(new AppError('Shipment not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

exports.generateShippingLabel = catchAsync(async (req, res, next) => {
  const { shipmentId, format } = req.body;

  const shipment = await Order.findById(shipmentId);

  if (!shipment) {
    return next(new AppError('Shipment not found', 404));  
  }

  // Generate shipping label using shipping carrier API
  const shippingLabel = await generateLabel(shipment, format);

  res.status(200).json({
    status: 'success',
    data: {
      shippingLabel  
    }
  });
});

exports.bulkCreateShipments = catchAsync(async (req, res) => {
  const shipments = req.body.shipments;

  const createdShipments = [];

  for (const shipment of shipments) {
    // Validate stock & update inventory (similar to createShipment)
    // ...

    // Create shipment
    const trackingNumber = await generateTrackingNumber();

    const order = await Order.findByIdAndUpdate(
      shipment.orderId,
      {
        shippingAddress: shipment.address,
        shippingMethod: shipment.method,
        trackingNumber,
        orderStatus: 'shipped'
      },
      {
        new: true
      }
    );

    createdShipments.push(order);

    // Send notifications
    await sendShippingNotifications(order);
  }

  res.status(200).json({
    status: 'success',
    results: createdShipments.length,
    data: {
      shipments: createdShipments
    }
  });
});

exports.bulkGenerateLabels = catchAsync(async (req, res) => {
  const { shipmentIds } = req.body;

  const shippingLabels = await Promise.all(
    shipmentIds.map(async (shipmentId) => {
      const shipment = await Order.findById(shipmentId);
      const label = await generateLabel(shipment, 'pdf');
      return label;
    })
  );

  // Create zip file of labels
  const zip = await createLabelZip(shippingLabels);

  res.attachment('labels.zip');
  res.status(200).send(zip);
});

exports.createReturn = catchAsync(async (req, res, next) => {
  const { orderId, items, reason } = req.body;

  const order = await Order.findById(orderId);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Validate return items are part of the order
  for (const item of items) {
    const found = order.items.find(
      orderItem => orderItem.product.toString() === item.productId
    );

    if (!found || found.quantity < item.quantity) {
      return next(new AppError('Invalid return items', 400));
    }
  }

  // Create return
  const returnRequest = {
    order: orderId,
    items,
    reason,
    status: 'pending'
  };

  // Implement creating return in your database
  // ...

  // Send return notification to admin
  await createNotification(
    null,
    'system',
    'New Return Request',
    `Return request created for order ${order.orderNumber}`
  );

  res.status(201).json({
    status: 'success',
    data: {
      returnRequest
    }
  });
});

exports.getAllReturns = catchAsync(async (req, res) => {
  // Implement fetching returns from your database
  // ...

  res.status(200).json({
    status: 'success',
    results: returns.length,
    data: {
      returns
    }
  });
});

exports.getReturnById = catchAsync(async (req, res, next) => {
  // Implement fetching a single return from your database
  // ...

  if (!returnRequest) {
    return next(new AppError('Return request not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      returnRequest
    }
  });
});

exports.updateReturnStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  // Implement updating the return status in your database
  // ...

  if (!returnRequest) {
    return next(new AppError('Return request not found', 404));
  }

  // Handle refund if applicable
  if (status === 'approved') {
    await processRefund(returnRequest.order, calculateRefundAmount(returnRequest));
  }

  // Send status update notifications
  await sendReturnStatusUpdateNotifications(returnRequest);

  res.status(200).json({
    status: 'success',
    data: {
      returnRequest
    }
  });
});

exports.getReturnsAnalytics = catchAsync(async (req, res) => {
  // Implement fetching return analytics from your database
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

exports.getCarrierPerformanceAnalytics = catchAsync(async (req, res) => {
  // Implement fetching carrier performance analytics from your database or shipping carrier APIs
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

exports.getShippingZonesAnalytics = catchAsync(async (req, res) => {
  // Implement fetching shipping zones analytics from your database
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

exports.syncCarrierRates = catchAsync(async (req, res) => {
  // Implement syncing shipping rates from carrier APIs
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Shipping rates synced successfully'
  });
});

exports.getCarrierServices = catchAsync(async (req, res) => {
  // Implement fetching available carrier services from shipping carrier APIs
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      services
    }
  });
});

exports.validateAddress = catchAsync(async (req, res, next) => {
  const { address } = req.body;

  // Implement address validation using shipping carrier APIs
  // ...

  if (!isValid) {
    return next(new AppError('Invalid shipping address', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      validatedAddress
    }
  });
});

exports.getShippingSettings = catchAsync(async (req, res) => {
    // Implement fetching shipping settings from your database
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      settings
    }
  });
});

exports.updateShippingSettings = catchAsync(async (req, res) => {
  const {
    defaultCarrier,
    freeShippingThreshold,
    handlingFee,
    insuranceSettings,
    packagingTypes
  } = req.body;

  // Implement updating shipping settings in your database
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Shipping settings updated successfully'
  });
});

exports.exportShipments = catchAsync(async (req, res) => {
  // Implement exporting shipments to a CSV file
  // ...

  res.attachment('shipments.csv');
  res.status(200).send(csv);
});

exports.exportReturns = catchAsync(async (req, res) => {
  // Implement exporting returns to a CSV file
  // ...

  res.attachment('returns.csv');
  res.status(200).send(csv);
});

// Helper Functions

const calculateWeightAndDimensions = async (items) => {
  // Implement calculating total weight and dimensions based on cart items
  // ...

  return {
    totalWeight,
    totalVolume
  };
};

const calculateShippingCost = async (shippingMethod, weightAndDimensions, items) => {
  // Implement calculating shipping cost based on shipping method, weight, dimensions, and cart value
  // ...

  return shippingCost;
};

const getTrackingDetails = async (trackingNumber) => {
  // Implement fetching tracking details from shipping carrier APIs
  // ...

  return trackingDetails;
};

const generateTrackingNumber = async () => {
  // Implement generating a unique tracking number
  // ...

  return trackingNumber;
};

const sendShippingNotifications = async (order) => {
  // Send email notification
  await sendEmail(
    order.user.email,
    'Order Shipped',
    'order-shipped',
    {
      order,
      trackingUrl: generateTrackingUrl(order.trackingNumber)
    }
  );

  // Send SMS if phone number exists
  if (order.user.phone) {
    await sendSms(
      order.user.phone,
      `Your order ${order.orderNumber} has been shipped. Track here: ${generateTrackingUrl(order.trackingNumber)}`
    );
  }

  // Create in-app notification
  await createNotification(
    order.user,
    'order',
    'Order Shipped',
    `Your order ${order.orderNumber} has been shipped`
  );
};

const generateLabel = async (shipment, format) => {
  // Implement generating shipping label using shipping carrier APIs
  // ...

  return label;
};

const createLabelZip = async (labels) => {
  // Implement creating a zip file from multiple shipping labels
  // ...

  return zip;
};

const calculateRefundAmount = (returnRequest) => {
  // Implement calculating refund amount based on return items
  // ...

  return refundAmount;
};

const sendReturnStatusUpdateNotifications = async (returnRequest) => {
  // Implement sending notifications on return status updates
  // ...
};

const processRefund = async (orderId, amount) => {
  // Implement processing refund using payment gateway
  // ...
};

const generateTrackingUrl = (trackingNumber) => {
  // Implement generating tracking URL based on tracking number and shipping carrier
  // ...

  return trackingUrl;
};