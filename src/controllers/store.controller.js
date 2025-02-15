// src/controllers/store.controller.js
const Store = require('../models/store.model');
const Service = require('../models/services.model');
const Inventory = require('../models/inventory.model');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const { uploadToCloudinary } = require('../utils/fileUpload');

// Public Routes

exports.getAllStores = catchAsync(async (req, res) => {
  const stores = await Store.find({ status: 'active' })
    .select('-inventory -createdAt -updatedAt -__v');

  res.status(200).json({
    status: 'success',
    results: stores.length,
    data: {
      stores
    }
  });
});

exports.getNearbyStores = catchAsync(async (req, res, next) => {
  const { latitude, longitude, radius = 10 } = req.query;

  if (!latitude || !longitude) {
    return next(new AppError('Please provide latitude and longitude', 400));
  }

  const stores = await Store.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radius * 1000
      }
    },
    status: 'active'
  }).select('-inventory -createdAt -updatedAt -__v');

  res.status(200).json({
    status: 'success',
    results: stores.length,
    data: {
      stores
    }
  });
});

exports.getStoreById = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id)
    .select('-inventory -createdAt -updatedAt -__v');

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      store
    }
  });
});


const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Order = require('../models/order.model');

// Image upload middleware
exports.uploadStoreImages = catchAsync(async (req, res, next) => {
  if (!req.files) return next();

  // Upload multiple images 
  const uploadPromises = req.files.map(async file => {
    const result = await uploadToCloudinary(file, {
      folder: 'stores'
    });

    return {
      public_id: result.public_id,
      url: result.secure_url,
      alt: file.originalname
    };
  });

  req.body.images = await Promise.all(uploadPromises);
  next();
});

// Existing methods: getStoreAppointments and bookAppointment
exports.getStoreAppointments = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  const appointments = await Appointment.find({
    store: store._id,
    user: req.user._id, // Only get current user's appointments
    status: { $nin: ['cancelled', 'no_show'] }
  })
    .populate('service')
    .sort({ appointmentDate: -1 });

  res.status(200).json({
    status: 'success',
    results: appointments.length,
    data: {
      appointments
    }
  });
});

exports.bookAppointment = catchAsync(async (req, res, next) => {
  const { serviceId, date, timeSlot } = req.body;
  const store = await Store.findById(req.params.id);

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  // Validate service
  const service = await Service.findOne({
    _id: serviceId,
    isActive: true
  });

  if (!service) {
    return next(new AppError('Service not found or inactive', 404));
  }

  // Check time slot availability
  const existingAppointment = await Appointment.findOne({
    store: store._id,
    service: service._id,
    appointmentDate: new Date(date),
    'timeSlot.startTime': timeSlot.startTime,
    'timeSlot.endTime': timeSlot.endTime,
    status: { $nin: ['cancelled', 'no_show'] }
  });

  if (existingAppointment) {
    return next(new AppError('Selected time slot is not available', 400));
  }

  // Create appointment
  const appointment = await Appointment.create({
    user: req.user._id,
    service: service._id,
    store: store._id,
    appointmentDate: new Date(date),
    timeSlot: {
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime
    },
    status: 'scheduled'
  });

  res.status(201).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

// Analytics routes implementations
exports.getStoreSalesAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  const { startDate, endDate } = req.query;

  const salesAnalytics = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        // Assumes you have a way to link orders to stores
        store: store._id 
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        totalSales: { $sum: '$total' },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: '$total' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      salesAnalytics
    }
  });
});

exports.getStoreAppointmentAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  const { startDate, endDate } = req.query;

  const appointmentAnalytics = await Appointment.aggregate([
    {
      $match: {
        store: store._id,
        appointmentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalAppointments = await Appointment.countDocuments({
    store: store._id,
    appointmentDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      appointmentAnalytics,
      totalAppointments
    }
  });
});

exports.getStoreInventoryAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  const inventoryAnalytics = await Inventory.aggregate([
    {
      $match: { store: store._id }
    },
    {
      $group: {
        _id: '$stockStatus',
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalValue: { $sum: { $multiply: ['$quantity', '$product.regularPrice'] } }
      }
    }
  ]);

  const lowStockItems = await Inventory.find({
    store: store._id,
    quantity: { $lte: 10 }
  }).populate('product', 'name sku');

  res.status(200).json({
    status: 'success',
    data: {
      inventoryAnalytics,
      lowStockItems
    }
  });
});

exports.getStoreStaffAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  const staffAnalytics = await Appointment.aggregate([
    {
      $match: {
        store: store._id,
        staff: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$staff',
        totalAppointments: { $sum: 1 },
        completedAppointments: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'staffDetails'
      }
    },
    { $unwind: '$staffDetails' }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      staffAnalytics
    }
  });
});

exports.transferInventory = catchAsync(async (req, res, next) => {
  const { productId, quantity, toStoreId } = req.body;
  const fromStore = await Store.findById(req.params.id);
  const toStore = await Store.findById(toStoreId);

  if (!fromStore || !toStore) {
    return next(new AppError('Store not found', 404));
  }

  // Find source inventory
  const sourceInventory = await Inventory.findOne({
    store: fromStore._id,
    product: productId
  });

  if (!sourceInventory || sourceInventory.quantity < quantity) {
    return next(new AppError('Insufficient inventory', 400));
  }

  // Find or create destination inventory
  let destinationInventory = await Inventory.findOne({
    store: toStore._id,
    product: productId
  });

  if (!destinationInventory) {
    destinationInventory = new Inventory({
      store: toStore._id,
      product: productId,
      quantity: 0
    });
  }

  // Update inventories
  sourceInventory.quantity -= quantity;
  destinationInventory.quantity += quantity;

  await Promise.all([
    sourceInventory.save(),
    destinationInventory.save()
  ]);

  res.status(200).json({
    status: 'success',
    message: 'Inventory transferred successfully',
    data: {
      sourceInventory,
      destinationInventory
    }
  });
});

exports.getStoreServices = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  const services = await Service.find({
    _id: { $in: store.services },
    isActive: true
  });

  res.status(200).json({
    status: 'success',
    results: services.length,
    data: {
      services
    }
  });
});

exports.getStoreStaff = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id)
    .populate({
      path: 'staff',
      select: 'firstName lastName email'
    });

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  res.status(200).json({
    status: 'success',
    results: store.staff.length,
    data: {
      staff: store.staff
    }
  });
});

exports.getStoreAvailability = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  const availability = store.operatingHours.map((day) => ({
    day: day.day,
    isOpen: day.isOpen,
    openingTime: day.open,
    closingTime: day.close
  }));

  res.status(200).json({
    status: 'success',
    data: {
      availability
    }
  });
});

// Customer Routes

exports.getStoreAppointments = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  // Fetch user's appointments at the store
  // ...

  res.status(200).json({
    status: 'success',
    results: appointments.length,
    data: {
      appointments
    }
  });
});

exports.bookAppointment = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store || store.status !== 'active') {
    return next(new AppError('Store not found', 404));
  }

  // Create appointment
  // ...

  res.status(201).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

// Admin Routes

exports.createStore = catchAsync(async (req, res) => {
  const store = await Store.create({
    ...req.body,
    manager: req.user._id
  });

  res.status(201).json({
    status: 'success',
    data: {
      store
    }
  });
});

exports.updateStore = catchAsync(async (req, res, next) => {
  const store = await Store.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      store
    }
  });
});

exports.deleteStore = catchAsync(async (req, res, next) => {
  const store = await Store.findByIdAndUpdate(
    req.params.id,
    { status: 'permanently_closed' },
    { new: true }
  );

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: null
  });
});

exports.addStaffMember = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Check if user exists and has staff role
  // ...

  store.staff.addToSet(req.body.userId);
  await store.save();

  res.status(200).json({
    status: 'success',
    message: 'Staff member added successfully'
  });
});

exports.removeStaffMember = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  store.staff.pull(req.params.userId);
  await store.save();

  res.status(200).json({
    status: 'success',
    message: 'Staff member removed successfully'
  });
});

exports.addStoreService = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Check if service exists
  // ...

  store.services.addToSet(req.body.serviceId);
  await store.save();

  res.status(200).json({
    status: 'success',
    message: 'Service added to store successfully'
  });
});

exports.updateStoreService = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Check if service exists
  // ...

  // Update service availability
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Store service updated successfully'
  });
});

exports.removeStoreService = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  store.services.pull(req.params.serviceId);
  await store.save();

  res.status(200).json({
    status: 'success',
    message: 'Service removed from store successfully'
  });
});

exports.updateStoreHours = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  store.operatingHours = req.body.operatingHours;
  await store.save();

  res.status(200).json({
    status: 'success',
    message: 'Store hours updated successfully'
  });
});

exports.getStoreInventory = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  const inventory = await Inventory.find({ store: store._id })
    .populate('product', 'name sku images')
    .populate('variant', 'sku attributes');

  res.status(200).json({
    status: 'success',
    results: inventory.length,
    data: {
      inventory
    }
  });
});

exports.transferInventory = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Check if destination store exists
  // ...

  // Update inventory quantities
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Inventory transferred successfully'
  });
});

// Analytics Routes

exports.getStoreSalesAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Fetch store's sales analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

exports.getStoreAppointmentAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Fetch store's appointment analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

exports.getStoreInventoryAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Fetch store's inventory analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

exports.getStoreStaffAnalytics = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  // Fetch store's staff performance analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});