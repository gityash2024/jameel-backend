// src/routes/blog.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const blogController = require('../controllers/blog.controller');
const {cache} = require('../middleware/cache.middleware');

// Public routes
router.get('/', cache('5 minutes'), blogController.getAllPosts);
router.get('/featured', cache('10 minutes'), blogController.getFeaturedPosts);
router.get('/categories', cache('1 hour'), blogController.getCategories);
router.get('/tags', cache('1 hour'), blogController.getTags);
router.get('/:slug', cache('5 minutes'), blogController.getPostBySlug);
router.get('/category/:slug', cache('5 minutes'), blogController.getPostsByCategory);
router.get('/tag/:slug', cache('5 minutes'), blogController.getPostsByTag);
router.get('/:slug/comments', blogController.getPostComments);

// Authentication required for these routes
router.use(authenticate);

// Comment routes
router.post('/:slug/comments', blogController.addComment);

router.put('/comments/:id', blogController.updateComment);

router.delete('/comments/:id', blogController.deleteComment);

// Like/Unlike routes
router.post('/:slug/like', blogController.likePost);
router.delete('/:slug/like', blogController.unlikePost);

// Admin routes
router.use(authorize(['admin']));

// Post management
router.post('/',blogController.uploadFeaturedImage, blogController.createPost);

router.put('/:id', blogController.uploadFeaturedImage, blogController.updatePost);

router.delete('/:id', blogController.deletePost);

// Category management
router.post('/categories', validate({
  body: {
    name: 'required|string',
    description: 'string'
  }
}), blogController.createCategory);

router.put('/categories/:id', validate({
  body: {
    name: 'string',
    description: 'string'
  }
}), blogController.updateCategory);

router.delete('/categories/:id', blogController.deleteCategory);

// Tag management
router.post('/tags', validate({
  body: {
    name: 'required|string',
    description: 'string'
  }
}), blogController.createTag);

router.put('/tags/:id', validate({
  body: {
    name: 'string',
    description: 'string'
  }
}), blogController.updateTag);

router.delete('/tags/:id', blogController.deleteTag);

// Comment moderation
router.put('/comments/:id/status', validate({
  body: {
    status: 'required|string|in:pending,approved,rejected,spam'
  }
}), blogController.updateCommentStatus);

// Analytics
router.get('/analytics/views', blogController.getViewsAnalytics);
router.get('/analytics/popular', blogController.getPopularPosts);
router.get('/analytics/engagement', blogController.getEngagementMetrics);

module.exports = router;