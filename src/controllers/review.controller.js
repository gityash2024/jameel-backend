// src/controllers/review.controller.js
const Review = require('../models/review.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.uploadReviewImages = catchAsync(async (req, res, next) => {
  if (!req.files) return next();

  // Upload multiple images
  const uploadPromises = req.files.map(async file => {
    const result = await uploadToCloudinary(file, {
      folder: 'reviews'
    });

    return {
      public_id: result.public_id,
      url: result.secure_url
    };
  });

  req.body.images = await Promise.all(uploadPromises);
  next();
});

exports.getProductReviews = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Review.find({ 
      product: req.params.productId,
      status: 'approved'
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query
    .populate('user', 'firstName lastName avatar');

  const total = await Review.countDocuments({ 
    product: req.params.productId,
    status: 'approved'
  });

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    total,
    data: {
      reviews
    }
  });
});

exports.getProductReviewStats = catchAsync(async (req, res) => {
  const stats = await Review.aggregate([
    {
      $match: { 
        product: req.params.productId,
        status: 'approved'
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);

  const total = stats.reduce((acc, curr) => acc + curr.count, 0);
  const average = stats.reduce((acc, curr) => acc + (curr._id * curr.count), 0) / total;

  res.status(200).json({
    status: 'success',
    data: {
      total,
      average: average.toFixed(1),
      distribution: stats.sort((a, b) => b._id - a._id)
    }
  });
});
exports.getReviewAnalytics = catchAsync(async (req, res) => {
  // Implement logic to retrieve review analytics overview
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Review analytics data
    }
  });
});

exports.getRatingAnalytics = catchAsync(async (req, res) => {
  // Implement logic to retrieve rating analytics
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Rating analytics data
    }
  });
});

exports.getTrendingReviews = catchAsync(async (req, res) => {
  // Implement logic to retrieve trending reviews
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Trending reviews data
    }
  });
});

exports.getProductReviewSummary = catchAsync(async (req, res, next) => {
  const { productId } = req.params;

  // Implement logic to retrieve product review summary
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Product review summary data
    }
  });
});

exports.getCategoryReviewSummary = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;

  // Implement logic to retrieve category review summary
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Category review summary data
    }
  });
});

exports.exportReviews = catchAsync(async (req, res) => {
  const { status, startDate, endDate } = req.query;

  // Implement logic to export reviews based on filters
  // ...

  res.status(200).json({
    status: 'success',
    data: {
      // Exported reviews data
    }
  });
});
exports.getMyReviews = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Review.find({ user: req.user._id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query
    .populate('product', 'name images');

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews
    }
  });
});

exports.createReview = catchAsync(async (req, res, next) => {
  // Verify product purchase
  const hasOrdered = await Order.exists({
    user: req.user._id,
    'items.product': req.body.productId,
    status: 'delivered'
  });

  if (!hasOrdered) {
    return next(new AppError('You can only review products you have purchased', 400));
  }

  // Check for existing review
  const existingReview = await Review.findOne({
    user: req.user._id,
    product: req.body.productId
  });

  if (existingReview) {
    return next(new AppError('You have already reviewed this product', 400));
  }

  const review = await Review.create({
    ...req.body,
    user: req.user._id,
    product: req.body.productId,
    isVerifiedPurchase: true
  });

  // Update product rating
  await updateProductRating(req.body.productId);

  res.status(201).json({
    status: 'success',
    data: {
      review
    }
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Handle image deletions
  if (req.body.deletedImages) {
    for (const image of req.body.deletedImages) {
      await deleteFromCloudinary(image.public_id);
    }
    review.images = review.images.filter(
      img => !req.body.deletedImages.find(
        delImg => delImg.public_id === img.public_id
      )
    );
  }

  // Add new images
  if (req.body.images) {
    review.images.push(...req.body.images);
  }

  Object.assign(review, req.body);
  review.isEdited = true;
  review.editHistory.push({
    content: review.content,
    editedAt: Date.now()
  });

  await review.save();

  // Update product rating if rating changed
  if (req.body.rating) {
    await updateProductRating(review.product);
  }

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Delete review images
  for (const image of review.images) {
    await deleteFromCloudinary(image.public_id);
  }

  await review.remove();

  // Update product rating
  await updateProductRating(review.product);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.markReviewHelpful = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  if (review.helpfulVotes.includes(req.user._id)) {
    return next(new AppError('You have already marked this review as helpful', 400));
  }

  review.helpfulVotes.push(req.user._id);
  await review.save();

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  });
});

exports.removeHelpfulMark = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  review.helpfulVotes = review.helpfulVotes.filter(
    id => id.toString() !== req.user._id.toString()
  );
  await review.save();

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  });
});

exports.reportReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  review.reports.push({
    user: req.user._id,
    reason: req.body.reason,
    date: Date.now()
  });

  review.reportCount = review.reports.length;

  // Auto-moderate if report threshold reached
  if (review.reportCount >= process.env.REVIEW_REPORT_THRESHOLD) {
    review.status = 'pending';
    review.moderationNotes = 'Auto-moderated due to high report count';
  }

  await review.save();

  res.status(200).json({
    status: 'success',
    message: 'Review reported successfully'
  });
});

// Admin Routes

exports.getAllReviews = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Review.find(),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query
    .populate('user', 'firstName lastName email')
    .populate('product', 'name sku');

  const total = await Review.countDocuments();

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    total,
    data: {
      reviews
    }
  });
});

exports.getReviewById = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id)
    .populate('user', 'firstName lastName email')
    .populate('product', 'name sku images');

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  });
});

exports.updateReviewStatus = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  review.status = req.body.status;
  review.moderationNotes = req.body.moderationNotes;
  await review.save();

  // Update product rating if status changes to/from approved
  await updateProductRating(review.product);

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  });
});

exports.bulkModerateReviews = catchAsync(async (req, res) => {
  const updates = await Promise.all(
    req.body.reviews.map(async (review) => {
      const updatedReview = await Review.findByIdAndUpdate(
        review.id,
        {
          status: review.status,
          moderationNotes: review.moderationNotes
        },
        { new: true }
      );

      // Update product rating
      await updateProductRating(updatedReview.product);

      return updatedReview;
    })
  );

  res.status(200).json({
    status: 'success',
    results: updates.length,
    data: {
      reviews: updates
    }
  });
});

// Helper Functions

const updateProductRating = async (productId) => {
  const stats = await Review.aggregate([
    {
      $match: { 
        product: productId,
        status: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        numberOfReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      averageRating: stats[0].averageRating,
      numberOfReviews: stats[0].numberOfReviews
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      averageRating: 0,
      numberOfReviews: 0
    });
  }
};