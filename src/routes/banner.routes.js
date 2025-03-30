const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const upload = require('../../config/multer');

// Public route for active banner
router.get('/active', bannerController.getActiveBanner);

// Protected routes
router.use(authenticate);

// Admin-only routes
router.use(authorize(['admin']));

router.route('/')
  .get(bannerController.getAllBanners)
  .post(upload.single('image'), bannerController.createBanner);

router.route('/:id')
  .get(bannerController.getBanner)
  .patch(upload.single('image'), bannerController.updateBanner)
  .delete(bannerController.deleteBanner);

module.exports = router; 