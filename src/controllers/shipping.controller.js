// src/controllers/shipping.controller.js
const Shipping = require('../models/shipping.model');
const Order = require('../models/order.model');
const Inventory = require('../models/inventory.model');
const { sendEmail } = require('../services/email.service');
const { createNotification } = require('../services/notification.service');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const fedexService = require('../utils/fedex.service');
const logger = require('../utils/logger');
const Product = require('../models/product.model');

exports.calculateShippingRates = catchAsync(async (req, res, next) => {
  const { items, address } = req.body;

  if (!items || !address) {
    return next(new AppError('Items and delivery address are required', 400));
  }

  try {
    // If FedEx credentials are not set or we're in development, use mock rates
    if (!process.env.FEDEX_CLIENT_ID || !process.env.FEDEX_CLIENT_SECRET || process.env.NODE_ENV === 'development') {
      logger.info('Using mock FedEx shipping rates');
      
      // Mock response
      const mockRates = [
        {
          serviceType: 'FEDEX_GROUND',
          serviceName: 'FedEx Ground',
          amount: 8.99,
          currency: 'USD',
          estimatedDeliveryDays: 5
        },
        {
          serviceType: 'FEDEX_EXPRESS_SAVER',
          serviceName: 'FedEx Express Saver',
          amount: 12.99,
          currency: 'USD',
          estimatedDeliveryDays: 3
        },
        {
          serviceType: 'STANDARD_OVERNIGHT',
          serviceName: 'Standard Overnight',
          amount: 21.99,
          currency: 'USD',
          estimatedDeliveryDays: 1
        },
        {
          serviceType: 'PRIORITY_OVERNIGHT',
          serviceName: 'Priority Overnight',
          amount: 29.99,
          currency: 'USD',
          estimatedDeliveryDays: 1
        }
      ];

      return res.status(200).json({
        status: 'success',
        data: {
          rates: mockRates
        }
      });
    }

    // Get product information for each item
    const productIds = [...new Set(items.map(item => item.productId))];
    const products = await Product.find({ _id: { $in: productIds } });

    // Map products to items with weights and dimensions
    const shippingItems = items.map(item => {
      const product = products.find(p => p._id.toString() === item.productId.toString());
      return {
        quantity: item.quantity,
        weight: product.weight?.value || 1, // Default to 1 lb if no weight specified
        dimensions: product.dimensions || {
          length: 10,
          width: 10,
          height: 5,
          unit: 'IN'
        }
      };
    });

    // Get shipping rates from FedEx
    const ratesResponse = await fedexService.getRates({
      items: shippingItems,
      address
    });

    // Format the rates for our API response
    const rates = ratesResponse.output.rateReplyDetails.map(rate => ({
      serviceType: rate.serviceType,
      serviceName: rate.serviceName,
      amount: parseFloat(rate.ratedShipmentDetails[0].totalNetCharge),
      currency: rate.ratedShipmentDetails[0].currency,
      estimatedDeliveryDays: rate.commit?.transitTime 
        ? transitTimeToBusinessDays(rate.commit.transitTime) 
        : serviceTypeToEstimatedDays(rate.serviceType)
    }));

    res.status(200).json({
      status: 'success',
      data: {
        rates
      }
    });
  } catch (error) {
    logger.error('Error calculating shipping rates:', error);
    
    // Fallback to mock rates in case of error
    const mockRates = [
      {
        serviceType: 'FEDEX_GROUND',
        serviceName: 'FedEx Ground',
        amount: 8.99,
        currency: 'USD',
        estimatedDeliveryDays: 5
      },
      {
        serviceType: 'FEDEX_EXPRESS_SAVER',
        serviceName: 'FedEx Express Saver',
        amount: 12.99,
        currency: 'USD',
        estimatedDeliveryDays: 3
      },
      {
        serviceType: 'STANDARD_OVERNIGHT',
        serviceName: 'Standard Overnight',
        amount: 21.99,
        currency: 'USD',
        estimatedDeliveryDays: 1
      }
    ];

    res.status(200).json({
      status: 'success',
      data: {
        rates: mockRates,
        isMock: true
      }
    });
  }
});

exports.getShippingMethods = catchAsync(async (req, res) => {
  const methods = [
    {
      id: 'STANDARD_OVERNIGHT',
      name: 'Standard Overnight',
      description: 'Delivery by the next business day',
      estimatedDays: 1,
      estimatedCost: 15.99
    },
    {
      id: 'PRIORITY_OVERNIGHT',
      name: 'Priority Overnight', 
      description: 'Delivery by 10:30 AM the next business day',
      estimatedDays: 1,
      estimatedCost: 25.99
    },
    {
      id: 'FEDEX_GROUND',
      name: 'FedEx Ground',
      description: 'Delivery in 1-5 business days',
      estimatedDays: 3,
      estimatedCost: 8.99
    },
    {
      id: 'FEDEX_EXPRESS_SAVER',
      name: 'FedEx Express Saver',
      description: 'Delivery in 3 business days',
      estimatedDays: 3,
      estimatedCost: 12.99
    }
  ];

  res.status(200).json({
    status: 'success',
    data: {
      methods
    }
  });
});

exports.getDeliveryEstimate = catchAsync(async (req, res, next) => {
  const { postalCode, method } = req.query;
  
  if (!postalCode) {
    return next(new AppError('Postal code is required for delivery estimate', 400));
  }
  
  try {
    // Get the shipping method details
    let shippingMethod;
    if (method) {
      // Find the specified method
      const methods = [
        {
          id: 'STANDARD_OVERNIGHT',
          name: 'Standard Overnight',
          description: 'Delivery by the next business day',
          estimatedDays: 1
        },
        {
          id: 'PRIORITY_OVERNIGHT',
          name: 'Priority Overnight', 
          description: 'Delivery by 10:30 AM the next business day',
          estimatedDays: 1
        },
        {
          id: 'FEDEX_GROUND',
          name: 'FedEx Ground',
          description: 'Delivery in 1-5 business days',
          estimatedDays: 3
        },
        {
          id: 'FEDEX_EXPRESS_SAVER',
          name: 'FedEx Express Saver',
          description: 'Delivery in 3 business days',
          estimatedDays: 3
        }
      ];
      
      shippingMethod = methods.find(m => m.id === method);
      if (!shippingMethod) {
        return next(new AppError('Invalid shipping method', 400));
      }
    } else {
      // Default to the fastest method
      shippingMethod = {
        id: 'STANDARD_OVERNIGHT',
        name: 'Standard Overnight',
        estimatedDays: 1
      };
    }
    
    // Calculate delivery date based on shipping method and current date
    const today = new Date();
    const estimatedDeliveryDate = addBusinessDays(today, shippingMethod.estimatedDays);
    
    res.status(200).json({
      status: 'success',
      data: {
        postalCode,
        shippingMethod: {
          id: shippingMethod.id,
          name: shippingMethod.name
        },
        estimatedDeliveryDate,
        estimatedDays: shippingMethod.estimatedDays
      }
    });
  } catch (error) {
    logger.error('Error calculating delivery estimate:', error);
    return next(new AppError('Failed to calculate delivery estimate', 500));
  }
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
  const { trackingNumber } = req.params;

  if (!trackingNumber) {
    return next(new AppError('Tracking number is required', 400));
  }

  try {
    // If FedEx credentials are not set or we're in development mode, use mock tracking data
    if (!process.env.FEDEX_CLIENT_ID || !process.env.FEDEX_CLIENT_SECRET || process.env.NODE_ENV === 'development') {
      logger.info(`Using mock tracking data for: ${trackingNumber}`);
      
      // Generate a mock tracking response
      const mockEvents = [
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
          status: 'IN_TRANSIT',
          description: 'Shipment information sent to FedEx',
          location: 'MEMPHIS, TN, US'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
          status: 'IN_TRANSIT',
          description: 'Picked up',
          location: 'MEMPHIS, TN, US'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
          status: 'IN_TRANSIT',
          description: 'Arrived at FedEx location',
          location: 'INDIANAPOLIS, IN, US'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
          status: 'IN_TRANSIT',
          description: 'Departed FedEx location',
          location: 'INDIANAPOLIS, IN, US'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          status: 'OUT_FOR_DELIVERY',
          description: 'On FedEx vehicle for delivery',
          location: 'LOCAL CITY, STATE, US'
        }
      ];

      // For testing different statuses
      let status = 'IN_TRANSIT';
      let estimatedDeliveryDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // Tomorrow
      
      // Use last digit of tracking number to determine status for testing
      const lastDigit = parseInt(trackingNumber.slice(-1));
      if (lastDigit >= 8) {
        status = 'DELIVERED';
        mockEvents.push({
          timestamp: new Date().toISOString(),
          status: 'DELIVERED',
          description: 'Delivered',
          location: 'LOCAL CITY, STATE, US'
        });
        estimatedDeliveryDate = null;
      } else if (lastDigit >= 5) {
        status = 'OUT_FOR_DELIVERY';
        estimatedDeliveryDate = new Date().toISOString();
      }

      return res.status(200).json({
        status: 'success',
        data: {
          tracking: {
            trackingNumber,
            status,
            estimatedDeliveryDate,
            events: mockEvents,
            carrier: 'FedEx',
            serviceType: 'FedEx Ground',
            isMock: true
          }
        }
      });
    }

    // Get tracking information from FedEx
    const trackingInfo = await fedexService.trackShipment(trackingNumber);

    res.status(200).json({
      status: 'success',
      data: {
        tracking: trackingInfo
      }
    });
  } catch (error) {
    logger.error(`Error tracking shipment ${trackingNumber}:`, error);
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

// Calculate estimated delivery date based on shipping method
exports.getDeliveryEstimate = catchAsync(async (req, res) => {
  const { serviceType, postalCode } = req.query;

  if (!serviceType) {
    return next(new AppError('Shipping method is required', 400));
  }

  // Calculate business days based on shipping method
  let estimatedDays;
  switch (serviceType) {
    case 'STANDARD_OVERNIGHT':
    case 'PRIORITY_OVERNIGHT':
      estimatedDays = 1;
      break;
    case 'FEDEX_2_DAY':
    case 'FEDEX_2_DAY_AM':
      estimatedDays = 2;
      break;
    case 'FEDEX_EXPRESS_SAVER':
      estimatedDays = 3;
      break;
    case 'FEDEX_GROUND':
    default:
      // For ground, calculate based on distance (postal code)
      // This is a simple estimation - in a real app, you would use zone calculations
      estimatedDays = postalCode ? Math.floor(Math.random() * 3) + 2 : 5; // 2-5 days
      break;
  }

  // Calculate delivery date (adding business days)
  const deliveryDate = addBusinessDays(new Date(), estimatedDays);

  res.status(200).json({
    status: 'success',
    data: {
      estimatedDays,
      estimatedDeliveryDate: deliveryDate.toISOString(),
      formattedDate: deliveryDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })
    }
  });
});

// Utility functions
function addBusinessDays(date, days) {
  let result = new Date(date);
  let daysAdded = 0;
  
  while (daysAdded < days) {
    result.setDate(result.getDate() + 1);
    // Check if it's a weekday (1-5 are Monday to Friday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysAdded++;
    }
  }
  
  return result;
}

function transitTimeToBusinessDays(transitTime) {
  switch (transitTime) {
    case 'ONE_DAY': return 1;
    case 'TWO_DAYS': return 2;
    case 'THREE_DAYS': return 3;
    case 'FOUR_DAYS': return 4;
    case 'FIVE_DAYS': return 5;
    default: return 5; // Default to 5 business days
  }
}

function serviceTypeToEstimatedDays(serviceType) {
  switch (serviceType) {
    case 'STANDARD_OVERNIGHT':
    case 'PRIORITY_OVERNIGHT':
    case 'FIRST_OVERNIGHT':
      return 1;
    case 'FEDEX_2_DAY':
    case 'FEDEX_2_DAY_AM':
      return 2;
    case 'FEDEX_EXPRESS_SAVER':
      return 3;
    case 'FEDEX_GROUND':
      return 5;
    default:
      return 5;
  }
}

exports.createShippingLabel = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const { serviceType } = req.body;

  if (!orderId) {
    return next(new AppError('Order ID is required', 400));
  }

  // Find the order
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  try {
    // If we already have a tracking number and label URL, return it
    if (order.shipping?.trackingNumber && order.shipping?.labelUrl) {
      return res.status(200).json({
        status: 'success',
        message: 'Shipping label already exists',
        data: {
          trackingNumber: order.shipping.trackingNumber,
          labelUrl: order.shipping.labelUrl,
          shipmentId: order.shipping.shipmentId,
          serviceType: order.shipping.serviceType
        }
      });
    }

    // Create the shipment with FedEx
    const shippingInfo = await fedexService.createShipment({
      ...order.toObject(),
      shipping: {
        ...order.shipping,
        serviceType: serviceType || 'FEDEX_GROUND'
      }
    });

    // Update the order with shipping information
    order.shipping = {
      ...order.shipping,
      trackingNumber: shippingInfo.trackingNumber,
      labelUrl: shippingInfo.labelUrl,
      serviceType: shippingInfo.serviceType,
      shipmentId: shippingInfo.shipmentId,
      status: 'in_transit',
      shippedAt: new Date(),
      trackingHistory: [
        {
          status: 'in_transit',
          statusDetails: 'Shipping label created',
          location: 'Origin',
          timestamp: new Date(),
          isException: false
        }
      ]
    };

    // Update the order status if it's still pending or processing
    if (['pending', 'processing'].includes(order.orderStatus)) {
      order.orderStatus = 'shipped';
    }

    await order.save();

    res.status(200).json({
      status: 'success',
      message: 'Shipping label created successfully',
      data: {
        trackingNumber: shippingInfo.trackingNumber,
        labelUrl: shippingInfo.labelUrl,
        shipmentId: shippingInfo.shipmentId,
        serviceType: shippingInfo.serviceType
      }
    });
  } catch (error) {
    logger.error('Error creating shipping label:', error);
    
    // Create a fake label URL for testing in development
    if (process.env.NODE_ENV === 'development') {
      const mockTrackingNumber = `FDX${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const mockLabelUrl = `https://example.com/shipping-labels/${mockTrackingNumber}.pdf`;
      
      // Update the order with mock shipping information
      order.shipping = {
        ...order.shipping,
        trackingNumber: mockTrackingNumber,
        labelUrl: mockLabelUrl,
        serviceType: serviceType || 'FEDEX_GROUND',
        shipmentId: `SHIP${Date.now()}`,
        status: 'in_transit',
        shippedAt: new Date(),
        trackingHistory: [
          {
            status: 'in_transit',
            statusDetails: 'Shipping label created (mock)',
            location: 'Origin',
            timestamp: new Date(),
            isException: false
          }
        ]
      };
      
      // Update the order status
      if (['pending', 'processing'].includes(order.orderStatus)) {
        order.orderStatus = 'shipped';
      }
      
      await order.save();
      
      return res.status(200).json({
        status: 'success',
        message: 'Mock shipping label created for development',
        data: {
          trackingNumber: mockTrackingNumber,
          labelUrl: mockLabelUrl,
          shipmentId: order.shipping.shipmentId,
          serviceType: serviceType || 'FEDEX_GROUND',
          isMock: true
        }
      });
    }
    
    return next(new AppError('Failed to create shipping label', 500));
  }
});

exports.cancelShipment = catchAsync(async (req, res, next) => {
  const { shipmentId } = req.params;

  if (!shipmentId) {
    return next(new AppError('Shipment ID is required', 400));
  }

  try {
    // Find the order with this shipment ID
    const order = await Order.findOne({ 'shipping.shipmentId': shipmentId });
    
    if (!order) {
      return next(new AppError('Order with this shipment ID not found', 404));
    }
    
    // Cancel the shipment with FedEx
    if (process.env.NODE_ENV !== 'development' && process.env.FEDEX_CLIENT_ID && process.env.FEDEX_CLIENT_SECRET) {
      await fedexService.cancelShipment(shipmentId);
    }
    
    // Update the order shipping status
    order.shipping.status = 'cancelled';
    order.shipping.cancellationDate = new Date();
    
    // Add cancellation to tracking history
    order.shipping.trackingHistory.push({
      status: 'cancelled',
      statusDetails: 'Shipment cancelled',
      location: '',
      timestamp: new Date(),
      isException: false
    });
    
    await order.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Shipment cancelled successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber
      }
    });
  } catch (error) {
    logger.error('Error cancelling shipment:', error);
    
    // For development, allow mock cancellation
    if (process.env.NODE_ENV === 'development') {
      const order = await Order.findOne({ 'shipping.shipmentId': shipmentId });
      
      if (order) {
        order.shipping.status = 'cancelled';
        order.shipping.cancellationDate = new Date();
        
        order.shipping.trackingHistory.push({
          status: 'cancelled',
          statusDetails: 'Shipment cancelled (mock)',
          location: '',
          timestamp: new Date(),
          isException: false
        });
        
        await order.save();
        
        return res.status(200).json({
          status: 'success',
          message: 'Mock shipment cancellation for development',
          data: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            isMock: true
          }
        });
      }
    }
    
    return next(new AppError('Failed to cancel shipment', 500));
  }
});