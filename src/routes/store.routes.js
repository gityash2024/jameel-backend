// src/routes/store.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const storeController = require('../controllers/store.controller');
const {cache} = require('../middleware/cache.middleware');

// Public routes
router.get('/', cache('1 hour'), storeController.getAllStores);
router.get('/nearby', validate({
  query: {
    latitude: 'required|number',
    longitude: 'required|number',
    radius: 'number'
  }
}), storeController.getNearbyStores);

router.get('/:id', cache('1 hour'), storeController.getStoreById);
router.get('/:id/services', cache('1 hour'), storeController.getStoreServices);
router.get('/:id/staff', cache('1 hour'), storeController.getStoreStaff);
router.get('/:id/availability', storeController.getStoreAvailability);

// Protected routes
router.use(authenticate);

// Customer routes
router.get('/:id/appointments', storeController.getStoreAppointments);
router.post('/:id/appointments', validate({
  body: {
    serviceId: 'required|string',
    date: 'required|date',
    timeSlot: 'required|string'
  }
}), storeController.bookAppointment);

// Admin routes
router.use(authorize(['admin']));

// Store management
router.post('/', validate({
  body: {
    name: 'required|string',
    branchCode: 'required|string',
    address: {
      street: 'required|string',
      city: 'required|string',
      state: 'required|string',
      postalCode: 'required|string',
      country: 'required|string'
    },
    location: {
      type: 'required|string|in:Point',
      coordinates: 'required|array'
    },
    contactInfo: {
      phone: 'required|string',
      email: 'required|string',
      website: 'string'
    },
    operatingHours: 'required|array'
  }
}), storeController.uploadStoreImages, storeController.createStore);

router.put('/:id', validate({
  body: {
    name: 'string',
    address: 'object',
    location: 'object',
    contactInfo: 'object',
    operatingHours: 'array'
  }
}), storeController.uploadStoreImages, storeController.updateStore);

router.delete('/:id', storeController.deleteStore);

// Store staff management
router.post('/:id/staff', validate({
  body: {
    userId: 'required|string',
    role: 'required|string'
  }
}), storeController.addStaffMember);

router.delete('/:id/staff/:userId', storeController.removeStaffMember);

// Store service management
router.post('/:id/services', validate({
  body: {
    serviceId: 'required|string',
    availability: 'required|object'
  }
}), storeController.addStoreService);

router.put('/:id/services/:serviceId', validate({
  body: {
    availability: 'required|object'
  }
}), storeController.updateStoreService);

router.delete('/:id/services/:serviceId', storeController.removeStoreService);

// Store hours management
router.put('/:id/hours', validate({
  body: {
    operatingHours: 'required|array'
  }
}), storeController.updateStoreHours);

// Store inventory management
router.get('/:id/inventory', storeController.getStoreInventory);
router.post('/:id/inventory/transfer', validate({
  body: {
    productId: 'required|string',
    quantity: 'required|number',
    toStoreId: 'required|string'
  }
}), storeController.transferInventory);

// Store analytics
router.get('/:id/analytics/sales', storeController.getStoreSalesAnalytics);
router.get('/:id/analytics/appointments', storeController.getStoreAppointmentAnalytics);
router.get('/:id/analytics/inventory', storeController.getStoreInventoryAnalytics);
router.get('/:id/analytics/staff', storeController.getStoreStaffAnalytics);

module.exports = router;