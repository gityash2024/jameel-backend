// src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const productValidator = require('../validators/product.validator');
const productController = require('../controllers/product.controller');
const {cache} = require('../middleware/cache.middleware');

// Public routes - specific routes first
router.get('/suggestions', productController.getProductSuggestions);
router.get('/featured', cache('5 minutes'), productController.getFeaturedProducts);
router.get('/new-arrivals', cache('5 minutes'), productController.getNewArrivals);
router.get('/web', cache('5 minutes'), productController.getWebProducts);
router.get('/search', productController.searchProducts);
router.get('/id/:id', cache('5 minutes'), productController.getProductById);
router.get('/category/:slug', cache('5 minutes'), productController.getProductsByCategory);

// General routes
router.get('/', cache('5 minutes'), productController.getAllProducts);
router.get('/:slug', cache('5 minutes'), productController.getProductBySlug);

router.use(authenticate);

router.post('/:id/reviews',  productController.createProductReview);
router.get('/:id/reviews', productController.getProductReviews);

// Admin only routes
router.use(authorize(['admin']));

router.post('/', 
  productController.uploadProductImages,
  productController.createProduct
);

router.put('/:id', 
  productController.uploadProductImages,
  productController.updateProduct
);

router.delete('/:id', productController.deleteProduct);

// Variant routes
router.post('/:id/variants', 
  validate(productValidator.createVariant),
  productController.uploadVariantImages, 
  productController.createVariant
);

router.put('/:id/variants/:variantId', 
  validate(productValidator.updateVariant),
  productController.uploadVariantImages,
  productController.updateVariant
);

router.delete('/:id/variants/:variantId', productController.deleteVariant);

// Bulk operations
router.post('/bulk/create', authorize(['admin']), productController.bulkCreateProducts);
router.put('/bulk/update', authorize(['admin']), productController.bulkUpdateProducts);
router.delete('/bulk/delete', authorize(['admin']), productController.bulkDeleteProducts);

module.exports = router;