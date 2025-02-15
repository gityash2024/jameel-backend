// src/validators/product.validator.js
const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

exports.createProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required')
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters long'),

  body('shortDescription')
    .trim()
    .notEmpty()
    .withMessage('Short description is required')
    .isLength({ max: 1000 })
    .withMessage('Short description cannot exceed 1000 characters'),

  body('type')
    .trim()
    .notEmpty()
    .withMessage('Product type is required')
    .isIn(['physical', 'digital'])
    .withMessage('Invalid product type'),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid category ID'),

  body('subCategories')
    .optional()
    .isArray()
    .withMessage('Sub-categories must be an array')
    .custom(value => value.every(id => mongoose.Types.ObjectId.isValid(id)))
    .withMessage('Invalid sub-category ID'),

  body('brand')
    .trim()
    .notEmpty()
    .withMessage('Brand is required'),

  body('regularPrice')
    .notEmpty()
    .withMessage('Regular price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('salePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Sale price must be a positive number')
    .custom((value, { req }) => {
      if (value >= req.body.regularPrice) {
        throw new Error('Sale price must be less than regular price');
      }
      return true;
    }),

  body('stockQuantity')
    .notEmpty()
    .withMessage('Stock quantity is required')
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be a non-negative integer'),

  body('attributes')
    .optional()
    .isArray()
    .withMessage('Attributes must be an array')
    .custom(value => {
      return value.every(attr => 
        attr.name && 
        typeof attr.name === 'string' && 
        attr.value && 
        typeof attr.value === 'string'
      );
    })
    .withMessage('Invalid attributes format'),

  body('specifications')
    .optional()
    .isArray()
    .withMessage('Specifications must be an array')
    .custom(value => {
      return value.every(spec => 
        spec.name && 
        typeof spec.name === 'string' && 
        spec.value && 
        typeof spec.value === 'string'
      );
    })
    .withMessage('Invalid specifications format'),

  body('dimensions')
    .optional()
    .isObject()
    .withMessage('Dimensions must be an object')
    .custom(value => {
      if (value) {
        if (typeof value.length !== 'number' || value.length < 0) {
          throw new Error('Invalid length dimension');
        }
        if (typeof value.width !== 'number' || value.width < 0) {
          throw new Error('Invalid width dimension');
        }
        if (typeof value.height !== 'number' || value.height < 0) {
          throw new Error('Invalid height dimension');
        }
        if (!['cm', 'in'].includes(value.unit)) {
          throw new Error('Invalid dimension unit');
        }
      }
      return true;
    }),

  body('weight')
    .optional()
    .isObject()
    .withMessage('Weight must be an object')
    .custom(value => {
      if (value) {
        if (typeof value.value !== 'number' || value.value < 0) {
          throw new Error('Invalid weight value');
        }
        if (!['g', 'kg', 'lb', 'oz'].includes(value.unit)) {
          throw new Error('Invalid weight unit');
        }
      }
      return true;
    }),

  body('materials')
    .optional()
    .isArray()
    .withMessage('Materials must be an array')
    .custom(value => value.every(material => typeof material === 'string'))
    .withMessage('Invalid materials format'),

  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),

  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters'),

  body('metaKeywords')
    .optional()
    .isArray()
    .withMessage('Meta keywords must be an array')
    .custom(value => value.every(keyword => typeof keyword === 'string'))
    .withMessage('Invalid meta keywords format')
];

exports.updateProduct = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid product ID'),

  ...exports.createProduct.map(validator => ({
    ...validator,
    optional: true
  }))
];

exports.createVariant = [
  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('SKU must be between 3 and 50 characters'),

  body('attributes')
    .isArray()
    .withMessage('Attributes must be an array')
    .notEmpty()
    .withMessage('At least one attribute is required'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('stockQuantity')
    .notEmpty()
    .withMessage('Stock quantity is required')
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be a non-negative integer')
];

exports.searchProducts = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters long'),

  query('category')
    .optional()
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid category ID'),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number')
    .custom((value, { req }) => {
      if (req.query.minPrice && Number(value) <= Number(req.query.minPrice)) {
        throw new Error('Maximum price must be greater than minimum price');
      }
      return true;
    }),

  query('sort')
    .optional()
    .isIn(['price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest', 'popular'])
    .withMessage('Invalid sort parameter'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];