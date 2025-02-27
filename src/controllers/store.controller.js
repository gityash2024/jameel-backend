const Store = require('../models/store.model');
const { AppError, catchAsync } = require('../utils/appError');

// Create a new store
exports.createStore = catchAsync(async (req, res, next) => {
  const {
    name,
    address,
    city,
    state,
    zipCode,
    phone,
    email,
    hours,
    features,
    coordinates,
    branchCode
  } = req.body;

  const store = await Store.create({
    name,
    address,
    city,
    state,
    zipCode,
    phone,
    email,
    hours,
    features,
    branchCode,
    location: {
      type: 'Point',
      coordinates: coordinates || [0, 0] // Default coordinates if not provided
    },
    image: req.body.image || null
  });

  res.status(201).json({
    status: 'success',
    message: 'Store created successfully',
    data: {
      store
    }
  });
});

// Get all stores
exports.getAllStores = catchAsync(async (req, res, next) => {
  // Add query parameters for filtering if needed
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(field => delete queryObj[field]);
  
  // Find all active stores by default
  const query = Store.find(queryObj);
  
  const stores = await query;

  res.status(200).json({
    status: 'success',
    results: stores.length,
    data: {
      stores
    }
  });
});

// Get a single store
exports.getStore = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.id);

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      store
    }
  });
});

// Update store
exports.updateStore = catchAsync(async (req, res, next) => {
  const {
    name,
    address,
    city,
    state,
    zipCode,
    phone,
    email,
    hours,
    features,
    coordinates,
    isActive
  } = req.body;

  const updateData = {
    name,
    address,
    city,
    state,
    zipCode,
    phone,
    email,
    hours,
    features,
    isActive
  };

  // Only update coordinates if provided
  if (coordinates) {
    updateData.location = {
      type: 'Point',
      coordinates
    };
  }

  if (req.body.image) {
    updateData.image = req.body.image;
  }

  const store = await Store.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  });

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Store updated successfully',
    data: {
      store
    }
  });
});

// Delete store
exports.deleteStore = catchAsync(async (req, res, next) => {
  const store = await Store.findByIdAndDelete(req.params.id);

  if (!store) {
    return next(new AppError('No store found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Find nearby stores
exports.findNearbyStores = catchAsync(async (req, res, next) => {
  const { lat, lng, distance = 10000 } = req.query; // distance in meters (default 10km)

  if (!lat || !lng) {
    return next(new AppError('Please provide latitude and longitude', 400));
  }

  const stores = await Store.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        },
        $maxDistance: parseInt(distance)
      }
    },
    isActive: true
  });

  res.status(200).json({
    status: 'success',
    results: stores.length,
    data: {
      stores
    }
  });
});