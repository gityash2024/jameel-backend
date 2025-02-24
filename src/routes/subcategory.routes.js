// routes/subcategory.routes.js
const express = require('express');
const router = express.Router();
const subcategoryController = require('../controllers/subcategory.controller');

// Get all subcategories (can be filtered by category using query param)
router.get('/', subcategoryController.getAllSubcategories);

// Get all subcategories for a specific category
router.get('/category/:categoryId', subcategoryController.getSubcategoriesByCategory);

// Get single subcategory
router.get('/:id', subcategoryController.getSubcategory);

// Create new subcategory
router.post('/', subcategoryController.createSubcategory);

// Update subcategory
router.put('/:id', subcategoryController.updateSubcategory);

// Delete subcategory
router.delete('/:id', subcategoryController.deleteSubcategory);

module.exports = router;