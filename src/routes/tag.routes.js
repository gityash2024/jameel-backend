// src/routes/tag.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const tagController = require('../controllers/tag.controller');
const { cache } = require('../middleware/cache.middleware');

// Validation schemas
const createTagSchema = {
  body: {
    name: 'required|string|max:50',
    description: 'string|max:500',
    isActive: 'boolean',
    metaTitle: 'string',
    metaDescription: 'string',
    metaKeywords: 'array'
  }
};

const updateTagSchema = {
  body: {
    name: 'string|max:50',
    description: 'string|max:500',
    isActive: 'boolean',
    metaTitle: 'string',
    metaDescription: 'string',
    metaKeywords: 'array'
  }
};

// Public routes
router.get('/', cache('10 minutes'), tagController.getAllTags);
router.get('/:slug', cache('10 minutes'), tagController.getTagBySlug);
router.get('/:slug/products', cache('5 minutes'), tagController.getTagProducts);

// Protected routes
router.use(authenticate, authorize(['admin']));

// CRUD operations
router.post('/', 
  tagController.createTag
);

router.put('/:id',
  tagController.updateTag
);

router.delete('/:id', tagController.deleteTag);

// Bulk operations
router.post('/bulk/create',

  tagController.bulkCreateTags
);

router.put('/bulk/update',

  tagController.bulkUpdateTags
);

router.delete('/bulk/delete',
  
  tagController.bulkDeleteTags
);

// Status update
router.put('/:id/status',

  tagController.updateTagStatus
);

module.exports = router;