const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');

const mediaController = require('../controllers/media.controller');

router.use(authenticate);

router.route('/')
  .get(mediaController.getAllMedia)
  .post(mediaController.uploadMedia);

router.route('/:id')
  .put(mediaController.updateMedia)
  .delete(mediaController.deleteMedia);

module.exports = router;