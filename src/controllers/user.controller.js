// src/controllers/user.controller.js
const User = require('../models/user.model');
const Address = require('../models/address.model');
const Wishlist = require('../models/wishlist.model');
const Product = require('../models/product.model')
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const { uploadToCloudinary } = require('../utils/fileUpload');
const multer = require('multer');

exports.getProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});
// Admin Routes

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find().populate('role', 'name');

  res.status(200).json({
    status: 'success',
    data: {
      users
    }
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate('role', 'name');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, phone, role, isActive } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      firstName,
      lastName,
      email,
      phone,
      role,
      isActive
    },
    {
      new: true,
      runValidators: true
    }
  ).populate('role', 'name');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});
exports.updateProfile = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      gender: req.body.gender,
      dateOfBirth: req.body.dateOfBirth
    },
    {
      new: true,
      runValidators: true
    }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

exports.updateAvatar = catchAsync(async (req, res) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }

  // Delete old avatar from Cloudinary if exists
  if (req.user.avatar?.public_id) {
    await deleteFromCloudinary(req.user.avatar.public_id);
  }

  // Upload new avatar to Cloudinary
  const result = await uploadToCloudinary(req.file, {
    folder: 'avatars',
    width: 150,
    height: 150,
    crop: 'fill'
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      avatar: {
        public_id: result.public_id,
        url: result.secure_url
      }
    },
    {
      new: true
    }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

exports.getAddresses = catchAsync(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id });

  res.status(200).json({
    status: 'success',
    results: addresses.length,
    data: {
      addresses
    }
  });
});

exports.addAddress = catchAsync(async (req, res) => {
  const address = await Address.create({
    ...req.body,
    user: req.user._id
  });

  res.status(201).json({
    status: 'success',
    data: {
      address
    }
  });
});

exports.updateAddress = catchAsync(async (req, res, next) => {
  const address = await Address.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user._id
    },
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      address
    }
  });
});

exports.deleteAddress = catchAsync(async (req, res, next) => {
  const address = await Address.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id
  });

  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.setDefaultAddress = catchAsync(async (req, res, next) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  await Address.updateMany(
    { user: req.user._id },
    { isDefault: false }
  );

  address.isDefault = true;
  await address.save();

  res.status(200).json({
    status: 'success',
    data: {
      address
    }
  });
});

exports.getWishlist = catchAsync(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id })
    .populate({
      path: 'products.product',
      select: 'name slug description images regularPrice salePrice stockQuantity stockStatus brand averageRating numberOfReviews sku isFeatured isNewArrival',
      populate: [
        { path: 'category', select: 'name slug' },
        { path: 'subcategory', select: 'name slug' }
      ]
    });

  if (!wishlist) {
    return res.status(200).json({
      status: 'success',
      data: {
        products: []
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      products: wishlist.products
    }
  });
});

exports.addToWishlist = catchAsync(async (req, res, next) => {
  const { productId } = req.body;
  
  if (!productId) {
    return next(new AppError('Product ID is required', 400));
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Find user's wishlist or create one
  let wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: req.user._id,
      products: [{ product: productId }]
    });
  } else {
    // Check if product already in wishlist
    const isProductInWishlist = wishlist.products.some(item => 
      item.product.toString() === productId
    );

    if (!isProductInWishlist) {
      wishlist.products.push({ product: productId });
      await wishlist.save();
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Product added to wishlist'
  });
});

exports.removeFromWishlist = catchAsync(async (req, res, next) => {
  const productId = req.params.productId;
  
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (!wishlist) {
    return next(new AppError('Wishlist not found', 404));
  }
  
  wishlist.products = wishlist.products.filter(item => 
    item.product.toString() !== productId
  );
  
  await wishlist.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Product removed from wishlist'
  });
});

exports.getWishlistCount = catchAsync(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  const count = wishlist ? wishlist.products.length : 0;
  
  res.status(200).json({
    status: 'success',
    data: {
      count
    }
  });
});

exports.clearWishlist = catchAsync(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (wishlist) {
    wishlist.products = [];
    await wishlist.save();
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Wishlist cleared'
  });
});



exports.getNotificationPreferences = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('notificationPreferences');

  res.status(200).json({
    status: 'success',
    data: {
      preferences: user.notificationPreferences
    }
  });
});

exports.updateNotificationPreferences = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      notificationPreferences: req.body
    },
    {
      new: true,
      runValidators: true
    }
  ).select('notificationPreferences');

  res.status(200).json({
    status: 'success',
    data: {
      preferences: user.notificationPreferences
    }
  });
});
// Add this to user.controller.js
exports.uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Please upload only images', 400), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
}).single('avatar');
exports.getPaymentMethods = catchAsync(async (req, res) => {
  // Fetch user's saved payment methods
  // Implement based on your payment gateway and database schema
  // ...

  res.status(200).json({
    status: 'success',
    results: paymentMethods.length,
    data: {
      paymentMethods
    }
  });
});

exports.addPaymentMethod = catchAsync(async (req, res) => {
  // Add new payment method
  // Implement based on your payment gateway and database schema
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Payment method added successfully'
  });
});

exports.deletePaymentMethod = catchAsync(async (req, res) => {
  // Delete payment method
  // Implement based on your payment gateway and database schema
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Payment method deleted successfully'
  });
});

exports.setDefaultPaymentMethod = catchAsync(async (req, res) => {
  // Set default payment method
  // Implement based on your payment gateway and database schema
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Default payment method updated successfully'
  });
});

exports.getRecentlyViewed = catchAsync(async (req, res) => {
  // Fetch recently viewed products
  // Implement based on your database schema and tracking mechanism
  // ...

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

exports.addToRecentlyViewed = catchAsync(async (req, res) => {
  // Add product to recently viewed
  // Implement based on your database schema and tracking mechanism
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Product added to recently viewed'
  });
});