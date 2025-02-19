// src/controllers/tag.controller.js
const Tag = require('../models/tag.model');
const Product = require('../models/product.model');
const AppError = require('../utils/appError');
const { catchAsync } = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const { cache } = require('../middleware/cache.middleware');

exports.getAllTags = catchAsync(async (req, res) => {
  const features = new APIFeatures(Tag.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const tags = await features.query;

  // Get product count for each tag
  const tagsWithCount = await Promise.all(
    tags.map(async (tag) => {
      const count = await Product.countDocuments({ tags: tag._id });
      return {
        ...tag.toObject(),
        productCount: count
      };
    })
  );

  res.status(200).json({
    status: 'success',
    results: tags.length,
    data: {
      tags: tagsWithCount
    }
  });
});

exports.getTagBySlug = catchAsync(async (req, res, next) => {
  const tag = await Tag.findOne({ slug: req.params.slug });

  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  const productCount = await Product.countDocuments({ tags: tag._id });

  res.status(200).json({
    status: 'success',
    data: {
      tag: {
        ...tag.toObject(),
        productCount
      }
    }
  });
});

exports.getTagProducts = catchAsync(async (req, res, next) => {
  const tag = await Tag.findOne({ slug: req.params.slug });
  
  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  const features = new APIFeatures(
    Product.find({ tags: tag._id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query
    .populate('category')
    .populate('variants');

  const total = await Product.countDocuments({ tags: tag._id });

  res.status(200).json({
    status: 'success',
    results: products.length,
    total,
    data: {
      tag,
      products
    }
  });
});

exports.createTag = catchAsync(async (req, res) => {
  const tag = await Tag.create({
    ...req.body,
    createdBy: req.user._id
  });


  res.status(201).json({
    status: 'success',
    data: {
      tag
    }
  });
});

exports.updateTag = catchAsync(async (req, res, next) => {
  const tag = await Tag.findById(req.params.id);
  
  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  Object.assign(tag, {
    ...req.body,
    updatedBy: req.user._id
  });
  
  await tag.save();


  res.status(200).json({
    status: 'success',
    data: {
      tag
    }
  });
});

exports.deleteTag = catchAsync(async (req, res, next) => {
  const tag = await Tag.findById(req.params.id);
  
  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  // Check if tag has associated products
  const hasProducts = await Product.exists({ tags: tag._id });
  if (hasProducts) {
    return next(new AppError('Cannot delete tag with associated products', 400));
  }

  await tag.deleteOne();



  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.bulkCreateTags = catchAsync(async (req, res) => {
  const tags = await Tag.insertMany(
    req.body.tags.map(tag => ({
      ...tag,
      createdBy: req.user._id
    }))
  );



  res.status(201).json({
    status: 'success',
    data: {
      tags
    }
  });
});

exports.bulkUpdateTags = catchAsync(async (req, res) => {
  const updates = await Promise.all(
    req.body.tags.map(async (tag) => {
      return await Tag.findByIdAndUpdate(
        tag._id,
        {
          ...tag,
          updatedBy: req.user._id
        },
        { new: true, runValidators: true }
      );
    })
  );


  res.status(200).json({
    status: 'success',
    data: {
      tags: updates
    }
  });
});

exports.bulkDeleteTags = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  // Check for products using these tags
  for (const id of ids) {
    const hasProducts = await Product.exists({ tags: id });
    if (hasProducts) {
      return next(new AppError(`Tag ${id} has associated products and cannot be deleted`, 400));
    }
  }

  await Tag.deleteMany({ _id: { $in: ids } });

  // Clear cache

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.updateTagStatus = catchAsync(async (req, res, next) => {
  const tag = await Tag.findById(req.params.id);
  
  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  tag.isActive = req.body.isActive;
  tag.updatedBy = req.user._id;
  await tag.save();

  
  res.status(200).json({
    status: 'success',
    data: {
      tag
    }
  });
});