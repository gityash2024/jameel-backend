// src/controllers/coupon.controller.js
const Coupon = require('../models/coupon.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, cartTotal } = req.body;

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });

  if (!coupon) {
    return next(new AppError('Invalid or expired coupon', 400));
  }

  // Check minimum purchase requirement
  if (coupon.minPurchase && cartTotal < coupon.minPurchase) {
    return next(new AppError(`Minimum purchase amount of ${coupon.minPurchase} required`, 400));
  }

  // Check usage limits
  if (coupon.usageLimit.perCoupon && coupon.usageCount >= coupon.usageLimit.perCoupon) {
    return next(new AppError('Coupon usage limit reached', 400));
  }

  if (req.user) {
    const userUsage = await Order.countDocuments({
      user: req.user._id,
      couponCode: code.toUpperCase()
    });

    if (coupon.usageLimit.perUser && userUsage >= coupon.usageLimit.perUser) {
      return next(new AppError('You have reached the usage limit for this coupon', 400));
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = (cartTotal * coupon.value) / 100;
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
      discount
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
  const { code, cartId } = req.body;

  const cart = await Cart.findById(cartId);
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });

  if (!coupon) {
    return next(new AppError('Invalid or expired coupon', 400));
  }

  // Validate product restrictions
  if (coupon.applicableProducts?.length > 0) {
    const hasValidProduct = cart.items.some(item => 
      coupon.applicableProducts.includes(item.product.toString())
    );
    if (!hasValidProduct) {
      return next(new AppError('Coupon not applicable to any items in cart', 400));
    }
  }

  // Validate category restrictions
  if (coupon.applicableCategories?.length > 0) {
    const cartProducts = await Product.find({
      _id: { $in: cart.items.map(item => item.product) }
    });
    
    const hasValidCategory = cartProducts.some(product => 
      coupon.applicableCategories.includes(product.category.toString())
    );
    if (!hasValidCategory) {
      return next(new AppError('Coupon not applicable to any items in cart', 400));
    }
  }

  cart.couponCode = code.toUpperCase();
  await cart.save();

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

// Admin Routes

exports.getAllCoupons = catchAsync(async (req, res) => {
  const features = new APIFeatures(Coupon.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const coupons = await features.query;
  const total = await Coupon.countDocuments();

  res.status(200).json({
    status: 'success',
    results: coupons.length,
    total,
    data: {
      coupons
    }
  });
});

exports.getCouponById = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

exports.createCoupon = catchAsync(async (req, res) => {
  // Generate unique code if not provided
  if (!req.body.code) {
    req.body.code = generateCouponCode();
  }

  const coupon = await Coupon.create({
    ...req.body,
    createdBy: req.user._id
  });

  res.status(201).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

exports.updateCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }

  Object.assign(coupon, req.body);
  await coupon.save();

  res.status(200).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }

  await coupon.remove();

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

exports.updateCouponStatus = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }

  coupon.isActive = req.body.isActive;
  await coupon.save();

  res.status(200).json({
    status: 'success',
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