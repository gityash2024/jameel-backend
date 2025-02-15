const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

exports.createPost = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),

  body('content')
    .trim()  
    .notEmpty()
    .withMessage('Content is required'),

  body('summary')
    .trim()
    .notEmpty()
    .withMessage('Summary is required')
    .isLength({ max: 500 })
    .withMessage('Summary cannot exceed 500 characters'),

  body('categories')
    .optional()
    .isArray()
    .withMessage('Categories must be an array')
    .custom(value => value.every(category => mongoose.Types.ObjectId.isValid(category)))  
    .withMessage('Invalid category ID'),

  body('tags')
    .optional()  
    .isArray()
    .withMessage('Tags must be an array'),

  body('status')  
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status'),

  body('publishDate')
    .optional()  
    .isISO8601()
    .withMessage('Publish date must be a valid ISO 8601 date'),

  body('isFeature')
    .optional()
    .isBoolean()
    .withMessage('IsFeature must be a boolean'),

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
];

exports.updatePost = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid post ID'),

  ...exports.createPost.map(validator => ({
    ...validator,
    optional: true
  }))   
];

exports.getPostComments = [
  param('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),  

  query('limit')  
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

exports.addComment = [
  param('slug')
    .trim()  
    .notEmpty()
    .withMessage('Slug is required'),

  body('content')
    .trim() 
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ max: 1000 })  
    .withMessage('Comment cannot exceed 1000 characters'),

  body('parent') 
    .optional()
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid parent comment ID') 
];

exports.updateComment = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid comment ID'), 

  body('content')
    .trim()
    .notEmpty() 
    .withMessage('Comment content is required')
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters')
];

exports.createCategory = [
  body('name')
    .trim()
    .notEmpty() 
    .withMessage('Category name is required'),
  
  body('description') 
    .optional()
    .trim()
];

exports.updateCategory = [
  param('id') 
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid category ID'),

  ...exports.createCategory
];

exports.createTag = [  
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Tag name is required'),

  body('description')  
    .optional()
    .trim()  
];

exports.updateTag = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value)) 
    .withMessage('Invalid tag ID'),

  ...exports.createTag  
];

exports.updateCommentStatus = [
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid comment ID'),

  body('status')   
    .trim()
    .notEmpty()
    .withMessage('Status is required') 
    .isIn(['pending', 'approved', 'rejected', 'spam'])
    .withMessage('Invalid status')
];