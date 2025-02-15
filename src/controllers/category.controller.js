// src/controllers/category.controller.js
const Category = require('../models/category.model');
const Product = require('../models/product.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const cache = require('../middleware/cache.middleware');

// Upload handler for category image
exports.uploadCategoryImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  const result = await uploadToCloudinary(req.file, {
    folder: 'categories'
  });

  req.body.image = {
    public_id: result.public_id,
    url: result.secure_url,
    alt: req.body.imageAlt || req.body.name
  };

  next();
});

exports.getAllCategories = catchAsync(async (req, res) => {
  const features = new APIFeatures(Category.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const categories = await features.query;

  // Get product count for each category
  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const count = await Product.countDocuments({ category: category._id });
      return {
        ...category.toObject(),
        productCount: count
      };
    })
  );

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories: categoriesWithCount
    }
  });
});

exports.getCategoryTree = catchAsync(async (req, res) => {
  const categories = await Category.find().sort('menuOrder');
  
  const buildTree = (items, parentId = null) => {
    const branch = [];
    
    items.forEach(item => {
      if ((item.parent?.toString() || null) === parentId) {
        const children = buildTree(items, item._id.toString());
        const categoryData = item.toObject();
        if (children.length) {
          categoryData.children = children;
        }
        branch.push(categoryData);
      }
    });
    
    return branch;
  };

  const tree = buildTree(categories);

  res.status(200).json({
    status: 'success',
    data: {
      categories: tree
    }
  });
});

exports.getCategoryBySlug = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.slug });

  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  // Get subcategories
  const subcategories = await Category.find({ parent: category._id });

  // Get product count
  const productCount = await Product.countDocuments({ category: category._id });

  res.status(200).json({
    status: 'success',
    data: {
      category: {
        ...category.toObject(),
        subcategories,
        productCount
      }
    }
  });
});

exports.getCategoryProducts = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.slug });
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  // Get all subcategory IDs
  const subcategories = await Category.find({ parent: category._id });
  const categoryIds = [category._id, ...subcategories.map(sub => sub._id)];

  const features = new APIFeatures(
    Product.find({ category: { $in: categoryIds } }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query
    .populate('brand')
    .populate('variants');

  const total = await Product.countDocuments({ category: { $in: categoryIds } });

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

exports.getSubcategories = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.slug });
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  const subcategories = await Category.find({ parent: category._id });

  // Get product count for each subcategory
  const subcategoriesWithCount = await Promise.all(
    subcategories.map(async (subcategory) => {
      const count = await Product.countDocuments({ category: subcategory._id });
      return {
        ...subcategory.toObject(),
        productCount: count
      };
    })
  );

  res.status(200).json({
    status: 'success',
    results: subcategories.length,
    data: {
      subcategories: subcategoriesWithCount
    }
  });
});

exports.createCategory = catchAsync(async (req, res) => {
  // Validate parent category if provided
  if (req.body.parent) {
    const parentCategory = await Category.findById(req.body.parent);
    if (!parentCategory) {
      return next(new AppError('Parent category not found', 404));
    }
    req.body.level = parentCategory.level + 1;
  } else {
    req.body.level = 0;
  }

  const category = await Category.create(req.body);

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(201).json({
    status: 'success',
    data: {
      category
    }
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  // Handle image update
  if (req.body.image && category.image?.public_id) {
    await deleteFromCloudinary(category.image.public_id);
  }

  // Update level if parent is changed
  if (req.body.parent !== undefined) {
    if (req.body.parent) {
      const parentCategory = await Category.findById(req.body.parent);
      if (!parentCategory) {
        return next(new AppError('Parent category not found', 404));
      }
      req.body.level = parentCategory.level + 1;
    } else {
      req.body.level = 0;
    }
  }

  Object.assign(category, req.body);
  await category.save();

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  // Check if category has subcategories
  const hasSubcategories = await Category.exists({ parent: category._id });
  if (hasSubcategories) {
    return next(new AppError('Cannot delete category with subcategories', 400));
  }

  // Check if category has products
  const hasProducts = await Product.exists({ category: category._id });
  if (hasProducts) {
    return next(new AppError('Cannot delete category with associated products', 400));
  }

  // Delete category image
  if (category.image?.public_id) {
    await deleteFromCloudinary(category.image.public_id);
  }

  await category.remove();

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.reorderCategories = catchAsync(async (req, res) => {
  const { categories } = req.body;

  await Promise.all(
    categories.map(async (item) => {
      await Category.findByIdAndUpdate(item.id, {
        menuOrder: item.order,
        parent: item.parent || null
      });
    })
  );

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(200).json({
    status: 'success',
    message: 'Categories reordered successfully'
  });
});

exports.bulkCreateCategories = catchAsync(async (req, res) => {
  const categories = await Category.insertMany(req.body.categories);

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(201).json({
    status: 'success',
    data: {
      categories
    }
  });
});

exports.bulkUpdateCategories = catchAsync(async (req, res) => {
  const updates = await Promise.all(
    req.body.categories.map(async (category) => {
      return await Category.findByIdAndUpdate(
        category._id,
        category,
        { new: true, runValidators: true }
      );
    })
  );

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(200).json({
    status: 'success',
    data: {
      categories: updates
    }
  });
});

exports.bulkDeleteCategories = catchAsync(async (req, res) => {
  const { ids } = req.body;

  // Check for subcategories
  for (const id of ids) {
    const hasSubcategories = await Category.exists({ parent: id });
    if (hasSubcategories) {
      return next(new AppError(`Category ${id} has subcategories and cannot be deleted`, 400));
    }
  }

  // Check for products
  for (const id of ids) {
    const hasProducts = await Product.exists({ category: id });
    if (hasProducts) {
      return next(new AppError(`Category ${id} has associated products and cannot be deleted`, 400));
    }
  }

  // Delete category images
  const categories = await Category.find({ _id: { $in: ids } });
  await Promise.all(
    categories.map(async (category) => {
      if (category.image?.public_id) {
        await deleteFromCloudinary(category.image.public_id);
      }
    })
  );

  await Category.deleteMany({ _id: { $in: ids } });

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.updateCategoryStatus = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  category.isActive = req.body.isActive;
  await category.save();

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});

exports.updateMenuVisibility = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  category.showInMenu = req.body.showInMenu;
  await category.save();

  // Clear cache
  await cache.deleteCache('categories:*');

  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});