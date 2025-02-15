// src/routes/media.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const mediaController = require('../controllers/media.controller');
const {cache} = require('../middleware/cache.middleware');

// All routes require authentication
router.use(authenticate);

// Public media access (still requires auth but available to all authenticated users)
router.get('/public/:id', cache('1 day'), mediaController.getPublicMedia);

// Protected routes that require admin/staff authorization
router.use(authorize(['admin', 'staff']));

// Media upload
router.post('/upload', 
  mediaController.uploadMiddleware,
  validate({
    body: {
      type: 'required|string|in:image,video,document',
      folder: 'string',
      alt: 'string',
      caption: 'string'
    }
  }), 
  mediaController.uploadMedia
);

router.post('/upload/bulk', 
  mediaController.uploadMiddleware,
  validate({
    body: {
      files: 'required|array',
      folder: 'string'
    }
  }), 
  mediaController.bulkUploadMedia
);

// Media retrieval
router.get('/', validate({
  query: {
    type: 'string|in:image,video,document',
    folder: 'string',
    page: 'integer',
    limit: 'integer',
    search: 'string'
  }
}), mediaController.getAllMedia);

router.get('/:id', mediaController.getMediaById);

router.get('/folder/:folderName', validate({
  query: {
    type: 'string|in:image,video,document',
    page: 'integer',
    limit: 'integer'
  }
}), mediaController.getMediaByFolder);

// Media management
router.put('/:id', validate({
  body: {
    alt: 'string',
    caption: 'string',
    folder: 'string',
    metadata: 'object'
  }
}), mediaController.updateMedia);

router.delete('/:id', mediaController.deleteMedia);

router.post('/bulk/delete', validate({
  body: {
    ids: 'required|array'
  }
}), mediaController.bulkDeleteMedia);

// Folder management
router.get('/folders/all', mediaController.getAllFolders);

router.post('/folders', validate({
  body: {
    name: 'required|string',
    parentFolder: 'string'
  }
}), mediaController.createFolder);

router.put('/folders/:id', validate({
  body: {
    name: 'string',
    parentFolder: 'string'
  }
}), mediaController.updateFolder);

router.delete('/folders/:id', mediaController.deleteFolder);

// Image optimization
router.post('/:id/optimize', validate({
  body: {
    quality: 'integer|min:1|max:100',
    width: 'integer',
    height: 'integer',
    format: 'string|in:jpeg,png,webp'
  }
}), mediaController.optimizeImage);

router.post('/bulk/optimize', validate({
  body: {
    ids: 'required|array',
    quality: 'integer|min:1|max:100',
    format: 'string|in:jpeg,png,webp'
  }
}), mediaController.bulkOptimizeImages);

// Media transformations
router.post('/:id/transform', validate({
  body: {
    operations: 'required|array',
    'operations.*.type': 'required|string|in:resize,crop,rotate,watermark',
    'operations.*.params': 'required|object'
  }
}), mediaController.transformMedia);

// Media usage tracking
router.get('/:id/usage', mediaController.getMediaUsage);

// Storage analytics
router.get('/analytics/storage', mediaController.getStorageAnalytics);
router.get('/analytics/usage', mediaController.getUsageAnalytics);

// Cleanup utilities
router.post('/cleanup/unused', mediaController.cleanupUnusedMedia);
router.post('/cleanup/duplicates', mediaController.cleanupDuplicates);

// Search functionality
router.post('/search', validate({
  body: {
    query: 'required|string',
    type: 'string|in:image,video,document',
    folder: 'string',
    metadata: 'object'
  }
}), mediaController.searchMedia);

module.exports = router;