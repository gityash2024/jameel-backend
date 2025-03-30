const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const mediaController = require('../controllers/media.controller');

// Public route for file uploads - doesn't require authentication
router.post('/upload', mediaController.uploadMedia);

// Routes that require authentication
router.use(authenticate);

// Get all media
router.get('/', mediaController.getAllMedia);

// Create media entry in database
router.post('/', mediaController.createMedia);

// Update media
router.put('/:id', mediaController.updateMedia);

// Delete media
router.delete('/:id', mediaController.deleteMedia);

module.exports = router;