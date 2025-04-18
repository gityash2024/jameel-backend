// src/controllers/product.controller.js
const Product = require('../models/product.model');
const Variant = require('../models/variant.model');
const Category = require('../models/category.model');
const APIFeatures = require('../utils/apiFeatures');

const Review = require('../models/review.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const { AppError, catchAsync } = require('../utils/appError'); // Fix: Import AppError as named import
// const APIFeatures = require('../utils/apiFeatures');
const { cache } = require('../middleware/cache.middleware');
const mongoose = require('mongoose');

exports.uploadProductImages = catchAsync(async (req, res, next) => {
  if (!req.files) return next();

  // Upload multiple images
  const uploadPromises = req.files.map(async file => {
    const result = await uploadToCloudinary(file, {
      folder: 'products'
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
// In src/controllers/product.controller.js modify getWebProducts:

exports.getWebProducts = catchAsync(async (req, res) => {
  // Default to 9 products per page for web frontend
  const defaultLimit = 9;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || defaultLimit;
  
  // Build the query based on filters
  let query = Product.find();
  
  // Handle subcategory filter specifically
  if (req.query.subcategory) {
    query = query.find({ subcategory: req.query.subcategory });
  }
  
  const features = new APIFeatures(
    query,
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .search(['name', 'description', 'brand']);

  const products = await features.query
    .populate('category')
    .populate('subcategory')
    .populate('variants');

  // Count total documents based on filter
  let countQuery = Product.find();
  if (req.query.subcategory) {
    countQuery = countQuery.find({ subcategory: req.query.subcategory });
  }
  const total = await countQuery.countDocuments();

  res.status(200).json({
    status: 'success',
    results: products.length,
    total,
    data: {
      products
    }
  });
});
exports.getAllProducts = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Product.find(),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .search(['name', 'description', 'brand']);

  const products = await features.query
  .populate('category')
  .populate('subcategory')  // Add this line
  .populate('variants');

  const total = await Product.countDocuments();

  res.status(200).json({
    status: 'success',
    results: products.length,
    total,
    data: {
      products
    }
  });
});

// Continuing from previous implementation...

exports.getFeaturedProducts = catchAsync(async (req, res) => {
    const products = await Product.find({ isFeatured: true, isActive: true })
      .populate('category')
      .populate('variants')
      .limit(10);
  
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  });
  
  exports.getNewArrivals = catchAsync(async (req, res) => {
    const products = await Product.find({ isActive: true, isNewArrival: true })
      .sort('-createdAt')
      .populate('category')
      .populate('variants')
      .limit(12);
  
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  });
  exports.uploadVariantImages = catchAsync(async (req, res, next) => {
    if (!req.files) return next();
  
    // Upload multiple images
    const uploadPromises = req.files.map(async file => {
      const result = await uploadToCloudinary(file, {
        folder: 'variants'
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
  
  exports.getProductBySlug = catchAsync(async (req, res, next) => {
    const product = await Product.findOne({ slug: req.params.slug })
    .populate('category')
  .populate('subcategory')  // Add this line
  .populate('variants')
  .populate({
    path: 'reviews',
    select: 'rating title content user createdAt',
    populate: {
      path: 'user',
      select: 'firstName lastName avatar'
    }
  });
  
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
  
    // Update view count
    product.viewCount = (product.viewCount || 0) + 1;
    await product.save({ validateBeforeSave: false });
  
    res.status(200).json({
      status: 'success',
      data: {
        product
      }
    });
  });
  exports.getProduct = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // Log the requested ID for debugging
    console.log(`Getting product with ID: ${id}`);

    // Check if ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`Invalid MongoDB ObjectId format: ${id}`);
      return next(new AppError('Invalid product ID format', 400));
    }

    const product = await Product.findById(id)
      .populate('category')
      .populate('subcategory')
      .populate('variants')
      .populate({
        path: 'reviews',
        select: 'rating title content user createdAt',
        populate: {
          path: 'user',
          select: 'firstName lastName avatar'
        }
      })
      .lean(); // Using lean() for better performance

    if (!product) {
      console.log(`Product not found with ID: ${id}`);
      return next(new AppError('Product not found', 404));
    }

    console.log(`Found product: ${product.name} (${product._id})`);

    // Include all jewelry details always, even if null
    const jewelryDetails = {
      stone: product.stone || null,
      totalWeight: product.totalWeight || null,
      color: product.color || null,
      clarity: product.clarity || null,
      stoneType: product.stoneType || null,
      stoneColor: product.stoneColor || null,
      stoneShape: product.stoneShape || null,
      stoneCaratRange: product.stoneCaratRange || null,
      stoneClass: product.stoneClass || null,
      stoneSetting: product.stoneSetting || null,
      settingOnly: product.settingOnly || false,
      metalType: product.metalType || null,
      metalColor: product.metalColor || null,
      metalFinish: product.metalFinish || null,
      goldKarat: product.goldKarat || null,
      ringDesign: product.ringDesign || null,
      ringStyle: product.ringStyle || null,
      standardRingSize: product.standardRingSize || null,
      height: product.height || null,
    };

    // Update view count
    await Product.findByIdAndUpdate(
      id, 
      { $inc: { viewCount: 1 } }, 
      { new: true, runValidators: false }
    );

    res.status(200).json({
      status: 'success',
      data: {
        product: {
          ...product,
          ...jewelryDetails
        }
      }
    });
  });
  
  exports.getProductsByCategory = catchAsync(async (req, res, next) => {
    const category = await Category.findOne({ slug: req.params.categorySlug });
    
    if (!category) {
      return next(new AppError('Category not found', 404));
    }
  
    // Get all subcategory IDs
    const subcategories = await Category.find({ parent: category._id });
    const categoryIds = [category._id, ...subcategories.map(sub => sub._id)];
  
    const features = new APIFeatures(
      Product.find({ 
        category: { $in: categoryIds },
        isActive: true 
      }),
      req.query
    )
      .filter()
      .sort()
      .limitFields()
      .paginate();
  
    const products = await features.query
      .populate('category')
      .populate('variants');
  
    const total = await Product.countDocuments({ 
      category: { $in: categoryIds },
      isActive: true 
    });
  
    res.status(200).json({
      status: 'success',
      results: products.length,
      total,
      data: {
        category,
        products
      }
    });
  });
  
  exports.searchProducts = catchAsync(async (req, res) => {
    const { q, minPrice, maxPrice, categories, brands } = req.query;
  
    const searchQuery = {
      isActive: true
    };
  
    // Full text search
    if (q) {
      searchQuery.$text = { $search: q };
    }
  
    // Price range
    if (minPrice || maxPrice) {
      searchQuery.regularPrice = {};
      if (minPrice) searchQuery.regularPrice.$gte = parseFloat(minPrice);
      if (maxPrice) searchQuery.regularPrice.$lte = parseFloat(maxPrice);
    }
  
    // Categories
    if (categories) {
      searchQuery.category = { 
        $in: categories.split(',') 
      };
    }
  
    // Brands
    if (brands) {
      searchQuery.brand = { 
        $in: brands.split(',') 
      };
    }
  
    const features = new APIFeatures(
      Product.find(searchQuery),
      req.query
    )
      .filter()
      .sort()
      .limitFields()
      .paginate();
  
    const products = await features.query
      .populate('category')
      .populate('variants');
  
    const total = await Product.countDocuments(searchQuery);
  
    res.status(200).json({
      status: 'success',
      results: products.length,
      total,
      data: {
        products
      }
    });
  });
  exports.createProduct = catchAsync(async (req, res) => {
    const { images, ...productData } = req.body;
    const parsedImages = JSON.parse(images);
  
    const product = await Product.create({
      ...productData,
      images: parsedImages,
      createdBy: req.user._id
    });
  
    // Clear cache
  
    res.status(201).json({
      status: 'success',
      data: {
        product
      }
    });
  });
  exports.updateProduct = catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
  
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
  
    // Handle image deletions
    if (req.body.deletedImages) {
      for (const image of req.body.deletedImages) {
        await deleteFromCloudinary(image.public_id);
      }
      product.images = product.images.filter(
        img => !req.body.deletedImages.find(
          delImg => delImg.public_id === img.public_id
        )
      );
    }
  
    // Add new images
    if (req.body.images) {
      product.images.push(...req.body.images);
    }
  
    Object.assign(product, req.body);
    product.updatedBy = req.user._id;
    await product.save();
  
    // Clear cache
    await('products:*');
  
    res.status(200).json({
      status: 'success',
      data: {
        product
      }
    });
  });
  
  exports.deleteProduct = catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
  
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
  
   
    await product.deleteOne();
  
    // Clear cache
  
    res.status(204).json({
      status: 'success',
      data: null
    });
  });
  
  exports.createVariant = catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
  
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
  
    const variant = await Variant.create({
      ...req.body,
      product: product._id
    });
  
    product.variants.push(variant._id);
    await product.save();
  
    res.status(201).json({
      status: 'success',
      data: {
        variant
      }
    });
  });
  
  exports.updateVariant = catchAsync(async (req, res, next) => {
    const variant = await Variant.findOne({
      _id: req.params.variantId,
      product: req.params.id
    });
  
    if (!variant) {
      return next(new AppError('Variant not found', 404));
    }
  
    Object.assign(variant, req.body);
    await variant.save();
  
    res.status(200).json({
      status: 'success',
      data: {
        variant
      }
    });
  });
  
  exports.deleteVariant = catchAsync(async (req, res, next) => {
    const variant = await Variant.findOne({
      _id: req.params.variantId,
      product: req.params.id
    });
  
    if (!variant) {
      return next(new AppError('Variant not found', 404));
    }
  
    // Delete variant images
    for (const image of variant.images || []) {
      await deleteFromCloudinary(image.public_id);
    }
  
    await variant.deleteOne();
  
    res.status(204).json({
      status: 'success',
      data: null
    });
  });
  
  exports.createProductReview = catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
  
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
  
    // Check if user has already reviewed
    const existingReview = await Review.findOne({
      product: product._id,
      user: req.user._id
    });
  
    if (existingReview) {
      return next(new AppError('You have already reviewed this product', 400));
    }
  
    const review = await Review.create({
      ...req.body,
      product: product._id,
      user: req.user._id
    });
  
    // Update product rating
    const stats = await Review.aggregate([
      {
        $match: { product: product._id }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          numReviews: { $sum: 1 }
        }
      }
    ]);
  
    product.averageRating = stats[0].avgRating;
    product.numberOfReviews = stats[0].numReviews;
    await product.save({ validateBeforeSave: false });
  
    res.status(201).json({
      status: 'success',
      data: {
        review
      }
    });
  });
  
  exports.getProductReviews = catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
  
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
  
    const features = new APIFeatures(
      Review.find({ product: product._id }),
      req.query
    )
      .filter()
      .sort()
      .limitFields()
      .paginate();
  
    const reviews = await features.query
      .populate('user', 'firstName lastName avatar');
  
    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: {
        reviews
      }
    });
  });
  
  exports.bulkCreateProducts = catchAsync(async (req, res) => {
    const products = await Product.insertMany(
      req.body.products.map(product => ({
        ...product,
        createdBy: req.user._id
      }))
    );
  
  
    res.status(201).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  });
  
  exports.bulkUpdateProducts = catchAsync(async (req, res) => {
    const updates = await Promise.all(
      req.body.products.map(async (product) => {
        return await Product.findByIdAndUpdate(
          product._id,
          { 
            ...product,
            updatedBy: req.user._id
          },
          { new: true, runValidators: true }
        );
      })
    );
  
    // Clear cache
  
    res.status(200).json({
      status: 'success',
      results: updates.length,
      data: {
        products: updates
      }
    });
  });
  
  exports.bulkDeleteProducts = catchAsync(async (req, res) => {
    const products = await Product.find({ _id: { $in: req.body.ids } });
  
    // Delete all product images
    for (const product of products) {
      for (const image of product.images) {
        await deleteFromCloudinary(image.public_id);
      }
    }
  
    await Product.deleteMany({ _id: { $in: req.body.ids } });
  
    // Clear cache
  
    res.status(204).json({
      status: 'success',
      data: null
    });
  });

exports.getProductSuggestions = catchAsync(async (req, res) => {
  let query = req.query.query;
  console.log(query,'query-______-----____-----____----___---');
  
  if (!query || query.length < 2) {
    return res.status(200).json({
      status: 'success',
      results: 0,
      data: {
        products: []
      }
    });
  }
  
  // Normalize the query
  query = query.trim();
  console.log(query,'query-______-----____-----____----___---');
  
  try {
    // Break down the query into potentially relevant terms
    // This helps match jewelry products with karat, material, and size terms
    const terms = query.split(/\s+/);
    
    // Create an array of regex patterns for each term
    const termPatterns = terms.map(term => new RegExp(term, 'i'));
    console.log(termPatterns,'termPatterns');
    console.log(query,'query');

    // Search for products that match the query or any of its terms
    const products = await Product.find({
      isActive: true,
      $or: [
        // Full query match in different fields
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { sku: { $regex: query, $options: 'i' } },
        
        // Match if name contains all the individual terms (in any order)
        { name: { $all: termPatterns } }
      ]
    })
    .select('name images slug price regularPrice salePrice _id') // Only select fields we need
    .limit(10) // Limit to 10 results for dropdown
    .populate('category', 'name slug');
    
    console.log(`Search for "${query}" returned ${products.length} results`);
    
    // Return empty array instead of error when no products found
    return res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  } catch (error) {
    console.error('Error in product suggestions:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error searching products',
      error: error.message
    });
  }
});

exports.getProductById = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('category')
    .populate('subcategory')
    .populate('variants')
    .populate({
      path: 'reviews',
      select: 'rating title content user createdAt',
      populate: {
        path: 'user',
        select: 'firstName lastName avatar'
      }
    });

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Update view count
  product.viewCount = (product.viewCount || 0) + 1;
  await product.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});