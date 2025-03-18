// src/controllers/coupon.controller.js
const Coupon = require('../models/coupon.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, amount } = req.body;

  if (!code) {
    return next(new AppError('Coupon code is required', 400));
  }

  const coupon = await Coupon.findOne({ 
    code: code.toUpperCase(),
    isActive: true,
    endDate: { $gte: new Date() },
    startDate: { $lte: new Date() }
  });

  if (!coupon) {
    return next(new AppError('Invalid or expired coupon code', 400));
  }

  // Check usage limit
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return next(new AppError('This coupon has reached its usage limit', 400));
  }

  // Check minimum order amount
  if (amount && coupon.minOrderAmount > 0 && amount < coupon.minOrderAmount) {
    return next(new AppError(`This coupon requires a minimum order of $${coupon.minOrderAmount}`, 400));
  }

  // Calculate discount
  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = amount ? (amount * coupon.value / 100) : coupon.value;
    
    // Apply max discount if specified
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else if (coupon.type === 'fixed') {
    discount = coupon.value;
  }

  res.status(200).json({
    status: 'success',
    data: {
      coupon,
      discount: amount ? discount : null,
      discountValue: coupon.value,
      discountType: coupon.type
    }
  });
});

exports.getMyCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find({
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  }).select('-usageLimit -usageCount');

  res.status(200).json({
    status: 'success',
    data: {
      coupons
    }
  });
});

exports.applyCoupon = catchAsync(async (req, res, next) => {
  const { code } = req.body;

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });

  if (!coupon) {
    return next(new AppError('Invalid or expired coupon', 400));
  }

  // Check usage limit
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return next(new AppError('This coupon has reached its usage limit', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      coupon,
      discountType: coupon.type,
      discountValue: coupon.value,
      maxDiscount: coupon.maxDiscount
    }
  });
});

// Admin Routes

exports.getAllCoupons = catchAsync(async (req, res, next) => {
  // Build filter
  let filter = {};
  
  // For active coupons only
  if (req.query.active === 'true') {
    filter.isActive = true;
    filter.endDate = { $gte: new Date() };
  }

  const coupons = await Coupon.find(filter);

  res.status(200).json({
    status: 'success',
    results: coupons.length,
    data: {
      coupons
    }
  });
});

exports.getCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError('No coupon found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

exports.createCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.create(req.body);

  res.status(201).json({
    status: 'success',
    message: 'Coupon created successfully',
    data: {
      coupon
    }
  });
});

exports.updateCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!coupon) {
    return next(new AppError('No coupon found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Coupon updated successfully',
    data: {
      coupon
    }
  });
});

exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);

  if (!coupon) {
    return next(new AppError('No coupon found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.bulkCreateCoupons = catchAsync(async (req, res) => {
  const coupons = req.body.coupons.map(coupon => ({
    ...coupon,
    createdBy: req.user._id,
    code: coupon.code || generateCouponCode()
  }));

  const createdCoupons = await Coupon.insertMany(coupons);

  res.status(201).json({
    status: 'success',
    data: {
      coupons: createdCoupons
    }
  });
});

exports.bulkUpdateCoupons = catchAsync(async (req, res) => {
  const updates = await Promise.all(
    req.body.coupons.map(async (coupon) => {
      return await Coupon.findByIdAndUpdate(
        coupon._id,
        coupon,
        { new: true, runValidators: true }
      );
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      coupons: updates
    }
  });
});

exports.bulkDeleteCoupons = catchAsync(async (req, res) => {
  await Coupon.deleteMany({ _id: { $in: req.body.ids } });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.toggleCouponStatus = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError('No coupon found with that ID', 404));
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  res.status(200).json({
    status: 'success',
    message: `Coupon status ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      coupon
    }
  });
});

exports.incrementCouponUsage = catchAsync(async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return next(new AppError('Coupon code is required', 400));
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });

  if (!coupon) {
    return next(new AppError('No coupon found with that code', 404));
  }

  coupon.usedCount += 1;
  await coupon.save();

  res.status(200).json({
    status: 'success',
    message: 'Coupon usage incremented successfully',
    data: {
      coupon
    }
  });
});

exports.getCouponUsageAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        couponCode: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$couponCode',
        count: { $sum: 1 },
        totalDiscount: { $sum: '$discount' },
        totalOrderValue: { $sum: '$total' }
      }
    },
    {
      $lookup: {
        from: 'coupons',
        localField: '_id',
        foreignField: 'code',
        as: 'couponDetails'
      }
    },
    { $unwind: '$couponDetails' }
  ];

  const usage = await Order.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      usage
    }
  });
});

exports.getCouponPerformanceMetrics = catchAsync(async (req, res) => {
  const metrics = await Order.aggregate([
    {
      $match: {
        couponCode: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$couponCode',
        totalOrders: { $sum: 1 },
        totalDiscount: { $sum: '$discount' },
        averageOrderValue: { $avg: '$total' },
        totalRevenue: { $sum: '$total' }
      }
    },
    {
      $lookup: {
        from: 'coupons',
        localField: '_id',
        foreignField: 'code',
        as: 'couponDetails'
      }
    },
    { $unwind: '$couponDetails' },
    {
      $project: {
        code: '$_id',
        totalOrders: 1,
        totalDiscount: 1,
        averageOrderValue: 1,
        totalRevenue: 1,
        discountRate: '$couponDetails.value',
        type: '$couponDetails.type',
        redemptionRate: {
          $divide: ['$totalOrders', '$couponDetails.usageLimit.perCoupon']
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      metrics
    }
  });
});

exports.exportCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find()
    .select('-__v')
    .lean();

  const csv = await generateCSV(coupons, [
    'code',
    'type',
    'value',
    'startDate',
    'endDate',
    'isActive',
    'usageCount'
  ]);

  res.attachment('coupons.csv');
  res.status(200).send(csv);
});

exports.updateCouponStatus = catchAsync(async (req, res, next) => {
  const { isActive } = req.body;
  
  if (typeof isActive !== 'boolean') {
    return next(new AppError('isActive must be a boolean value', 400));
  }

  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id, 
    { isActive },
    { new: true, runValidators: true }
  );

  if (!coupon) {
    return next(new AppError('No coupon found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `Coupon ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      coupon
    }
  });
});

// Helper Functions

const generateCouponCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 8;
  let code = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
};

const generateCSV = async (data, fields) => {
  const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
  
  const csvStringifier = createCsvStringifier({
    header: fields.map(field => ({
      id: field,
      title: field.toUpperCase()
    }))
  });

  const records = data.map(item => {
    const record = {};
    fields.forEach(field => {
      record[field] = item[field];
    });
    return record;
  });

  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
};