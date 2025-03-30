// src/controllers/shipping.controller.js
const Shipping = require('../models/shipping.model');
const Order = require('../models/order.model');
const Inventory = require('../models/inventory.model');
const { sendEmail } = require('../services/email.service');
const { createNotification } = require('../services/notification.service');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const fedexService = require('../utils/fedexService');
const logger = require('../utils/logger');

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
  const { orderId } = req.params;
  
  // Find the order
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Check if the order has a tracking number
  if (!order.shipping || !order.shipping.trackingNumber) {
    return next(new AppError('This order does not have a tracking number', 400));
  }
  
  try {
    const trackingNumber = order.shipping.trackingNumber;
    
    // Call FedEx API
    const trackingResponse = await fedexService.trackPackage(trackingNumber);
    
    // Extract tracking details
    const trackDetails = trackingResponse.output.completeTrackResults[0].trackResults[0];
    const latestStatus = trackDetails.latestStatusDetail;
    const scanEvents = trackDetails.scanEvents || [];
    
    // Format tracking events
    const trackingHistory = scanEvents.map(event => ({
      status: event.eventType,
      statusDetails: event.eventDescription,
      location: formatLocation(event.scanLocation),
      timestamp: new Date(event.date + 'T' + event.time),
      isException: !!event.exceptionDescription
    }));
    
    // Update order with latest tracking info
    order.shipping.status = mapFedExStatusToOrderStatus(latestStatus.code);
    order.shipping.trackingHistory = trackingHistory;
    order.shipping.lastUpdated = new Date();
    
    // Check if delivered
    if (order.shipping.status === 'delivered') {
      order.shipping.deliveredAt = new Date(latestStatus.statusByLocale.date + 'T' + latestStatus.statusByLocale.time);
      order.orderStatus = 'delivered';
      order.actualDeliveryDate = order.shipping.deliveredAt;
    } else if (order.shipping.status === 'out_for_delivery') {
      order.orderStatus = 'out_for_delivery';
    }
    
    await order.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        trackingNumber,
        currentStatus: order.shipping.status,
        statusDetails: latestStatus.statusByLocale.description,
        estimatedDelivery: order.estimatedDeliveryDate,
        lastUpdated: order.shipping.lastUpdated,
        trackingHistory
      }
    });
  } catch (error) {
    logger.error('Error tracking FedEx shipment', error);
    return next(new AppError(`Failed to track shipment: ${error.message}`, 500));
  }
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
  const { orderId } = req.params;
  const { serviceType, packageDetails } = req.body;
  
  // Find the order
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Check if order is in a valid state for shipping
  if (!['processing', 'packed'].includes(order.orderStatus)) {
    return next(new AppError(`Cannot create shipment for order in ${order.orderStatus} status`, 400));
  }
  
  // Check if shipment already exists
  if (order.shipping && order.shipping.trackingNumber) {
    return next(new AppError('Shipment already created for this order', 400));
  }
  
  try {
    // Prepare shipment data from order
    const shipmentData = {
      // Sender details (from store config)
      senderName: fedexConfig.storeAddress.name,
      senderPhone: fedexConfig.storeAddress.phone,
      senderEmail: fedexConfig.storeAddress.email,
      senderAddress1: fedexConfig.storeAddress.address1,
      senderAddress2: fedexConfig.storeAddress.address2,
      senderCity: fedexConfig.storeAddress.city,
      senderState: fedexConfig.storeAddress.state,
      senderPostalCode: fedexConfig.storeAddress.postalCode,
      senderCountry: fedexConfig.storeAddress.country,
      
      // Recipient details (from order)
      recipientName: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
      recipientPhone: order.shippingAddress.phone,
      recipientEmail: req.body.recipientEmail || 'customer@example.com',
      recipientAddress1: order.shippingAddress.addressLine1,
      recipientAddress2: order.shippingAddress.addressLine2 || '',
      recipientCity: order.shippingAddress.city,
      recipientState: order.shippingAddress.state,
      recipientPostalCode: order.shippingAddress.postalCode,
      recipientCountry: order.shippingAddress.country,
      
      // Package details
      serviceType: serviceType || fedexConfig.defaultShippingOptions.serviceType,
      packagingType: packageDetails?.packagingType || fedexConfig.defaultShippingOptions.packagingType,
      weight: packageDetails?.weight || calculateOrderWeight(order),
      length: packageDetails?.length || 10,
      width: packageDetails?.width || 10,
      height: packageDetails?.height || 10,
    };
    
    // Call FedEx API
    const shipmentResponse = await fedexService.createShipment(shipmentData);
    
    // Extract relevant data from response
    const trackingNumber = shipmentResponse.output.transactionShipments[0].trackingNumber;
    const labelContent = shipmentResponse.output.transactionShipments[0].pieceResponses[0].packageDocuments[0].encodedLabel;
    const labelUrl = fedexService.getLabelUrl(labelContent);
    
    // Update order with shipping information
    order.shipping = {
      provider: 'fedex',
      trackingNumber,
      trackingUrl: `${fedexConfig.trackingUrl}${trackingNumber}`,
      labelUrl,
      serviceType,
      packageWeight: shipmentData.weight,
      packageDimensions: {
        length: shipmentData.length,
        width: shipmentData.width,
        height: shipmentData.height,
        unit: 'in'
      },
      estimatedDeliveryDate: shipmentResponse.output.transactionShipments[0].completedShipmentDetail?.operationalDetail?.deliveryDate,
      shippedAt: new Date(),
      status: 'label_created',
      lastUpdated: new Date()
    };
    
    // Also update the legacy fields
    order.trackingNumber = trackingNumber;
    order.estimatedDeliveryDate = order.shipping.estimatedDeliveryDate;
    
    // Update order status
    order.orderStatus = 'shipped';
    
    await order.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        trackingNumber,
        trackingUrl: `${fedexConfig.trackingUrl}${trackingNumber}`,
        labelUrl,
        estimatedDelivery: order.shipping.estimatedDeliveryDate
      }
    });
  } catch (error) {
    logger.error('Error creating FedEx shipment', error);
    return next(new AppError(`Failed to create shipment: ${error.message}`, 500));
  }
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

/**
 * Calculate the estimated weight of an order
 * This would typically come from product details
 */
const calculateOrderWeight = (order) => {
  // Default to 1lb if no items or weights available
  if (!order.items || order.items.length === 0) {
    return 1;
  }
  
  // In a real implementation, you would calculate based on product weights
  // This is a simplified version
  return Math.max(1, order.items.reduce((total, item) => {
    // Assume each item weighs at least 0.5lb
    return total + (item.quantity * 0.5);
  }, 0));
};

/**
 * Format a location string from FedEx scan event
 */
const formatLocation = (scanLocation) => {
  if (!scanLocation) return 'Unknown location';
  
  const parts = [];
  if (scanLocation.city) parts.push(scanLocation.city);
  if (scanLocation.stateOrProvinceCode) parts.push(scanLocation.stateOrProvinceCode);
  if (scanLocation.countryCode && parts.length === 0) parts.push(scanLocation.countryCode);
  
  return parts.length > 0 ? parts.join(', ') : 'Unknown location';
};

/**
 * Map FedEx status codes to our internal status
 */
const mapFedExStatusToOrderStatus = (statusCode) => {
  // This mapping should be customized based on actual FedEx status codes
  const statusMap = {
    'DL': 'delivered',
    'OD': 'out_for_delivery',
    'IT': 'in_transit',
    'PU': 'picked_up',
    'DP': 'ready_for_pickup',
    'CC': 'cancelled',
    'DE': 'exception'
  };
  
  return statusMap[statusCode] || 'in_transit';
};