// src/routes/category.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const categoryController = require('../controllers/category.controller');
const {cache} = require('../middleware/cache.middleware');

// Public routes
router.get('/', cache('10 minutes'), categoryController.getAllCategories);
router.get('/tree', cache('10 minutes'), categoryController.getCategoryTree);
router.get('/:slug', cache('10 minutes'), categoryController.getCategoryBySlug);
router.get('/:slug/products', cache('5 minutes'), categoryController.getCategoryProducts);
router.get('/:slug/subcategories', cache('10 minutes'), categoryController.getSubcategories);

// Admin routes
router.use(authenticate, authorize(['admin']));

router.post('/', validate({
  body: {
    name: 'required|string',
    description: 'required|string',
    parent: 'string',
    image: 'object',
    icon: 'string',
    isActive: 'boolean',
    showInMenu: 'boolean',
    menuOrder: 'integer',
    metaTitle: 'string',
    metaDescription: 'string',
    metaKeywords: 'array'
  }
}), categoryController.uploadCategoryImage, categoryController.createCategory);

router.put('/:id', validate({
  body: {
    name: 'string',
    description: 'string',
    parent: 'string',
    image: 'object',
    icon: 'string',
    isActive: 'boolean',
    showInMenu: 'boolean',
    menuOrder: 'integer',
    metaTitle: 'string',
    metaDescription: 'string',
    metaKeywords: 'array'
  }
}), categoryController.uploadCategoryImage, categoryController.updateCategory);

router.delete('/:id', categoryController.deleteCategory);

// Category ordering
router.put('/reorder', validate({
  body: {
    categories: 'required|array'
  }
}), categoryController.reorderCategories);

// Bulk operations
router.post('/bulk/create', categoryController.bulkCreateCategories);
router.put('/bulk/update', categoryController.bulkUpdateCategories);
router.delete('/bulk/delete', categoryController.bulkDeleteCategories);

// Category status
router.put('/:id/status', validate({
  body: {
    isActive: 'required|boolean'
  }
}), categoryController.updateCategoryStatus);

// Menu visibility
router.put('/:id/menu-visibility', validate({
  body: {
    showInMenu: 'required|boolean'
  }
}), categoryController.updateMenuVisibility);

module.exports = router;