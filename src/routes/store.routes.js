const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const storeController = require('../controllers/store.controller');

// Public routes
router.get('/', storeController.getAllStores);
router.get('/nearby', storeController.findNearbyStores);
router.get('/:id', storeController.getStore);

// Protected routes
router.use(authenticate);


router.post('/', storeController.createStore);
router.put('/:id', storeController.updateStore);
router.delete('/:id', storeController.deleteStore);

module.exports = router;