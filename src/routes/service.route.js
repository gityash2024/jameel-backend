// src/routes/service.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const serviceController = require('../controllers/service.controller');
const cache = require('../middleware/cache.middleware');

// Public routes
router.get('/', cache('1 hour'), serviceController.getAllServices);
router.get('/categories', cache('1 day'), serviceController.getServiceCategories);
router.get('/:id', cache('1 hour'), serviceController.getServiceById);
router.get('/availability/:serviceId', serviceController.getServiceAvailability);

// Authentication required for all routes below
router.use(authenticate);

// Appointment routes
router.get('/appointments', serviceController.getMyAppointments);
router.get('/appointments/:id', serviceController.getAppointmentById);

router.post('/appointments', validate({
  body: {
    serviceId: 'required|string',
    storeId: 'required|string',
    appointmentDate: 'required|date',
    timeSlot: {
      startTime: 'required|string',
      endTime: 'required|string'
    },
    specialRequests: 'string'
  }
}), serviceController.createAppointment);

router.put('/appointments/:id', validate({
  body: {
    appointmentDate: 'date',
    timeSlot: {
      startTime: 'string',
      endTime: 'string'
    },
    specialRequests: 'string'
  }
}), serviceController.updateAppointment);

router.delete('/appointments/:id', serviceController.cancelAppointment);

// Appraisal routes
router.get('/appraisals', serviceController.getMyAppraisals);
router.get('/appraisals/:id', serviceController.getAppraisalById);

router.post('/appraisals', validate({
  body: {
    itemType: 'required|string|in:ring,necklace,bracelet,earrings,watch,other',
    description: 'required|string',
    appointmentId: 'string'
  }
}), serviceController.uploadAppraisalPhotos, serviceController.createAppraisal);

router.put('/appraisals/:id', validate({
  body: {
    description: 'string',
    appointmentId: 'string'
  }
}), serviceController.uploadAppraisalPhotos, serviceController.updateAppraisal);

// Jewelry Customization routes
router.get('/customization', serviceController.getMyCustomizations);
router.get('/customization/:id', serviceController.getCustomizationById);

router.post('/customization', validate({
  body: {
    type: 'required|string|in:ring,necklace,bracelet,earrings,other',
    specifications: {
      metal: 'required|string|in:gold_14k,gold_18k,platinum,silver',
      metalColor: 'required|string|in:yellow,white,rose',
      size: 'string',
      stones: 'array',
      engraving: 'object'
    }
  }
}), serviceController.uploadDesignImages, serviceController.createCustomization);

router.put('/customization/:id', validate({
  body: {
    specifications: {
      metal: 'string|in:gold_14k,gold_18k,platinum,silver',
      metalColor: 'string|in:yellow,white,rose',
      size: 'string',
      stones: 'array',
      engraving: 'object'
    }
  }
}), serviceController.uploadDesignImages, serviceController.updateCustomization);

// Admin routes
router.use(authorize(['admin']));

// Service management
router.post('/', validate({
  body: {
    name: 'required|string',
    description: 'required|string',
    category: 'required|string',
    duration: 'required|integer',
    price: 'required|number',
    isActive: 'boolean'
  }
}), serviceController.createService);

router.put('/:id', validate({
  body: {
    name: 'string',
    description: 'string',
    category: 'string',
    duration: 'integer',
    price: 'number',
    isActive: 'boolean'
  }
}), serviceController.updateService);

router.delete('/:id', serviceController.deleteService);

// Appointment management
router.get('/admin/appointments', serviceController.getAllAppointments);
router.put('/admin/appointments/:id/status', validate({
  body: {
    status: 'required|string|in:scheduled,confirmed,completed,cancelled,no_show'
  }
}), serviceController.updateAppointmentStatus);

// Appraisal management
router.get('/admin/appraisals', serviceController.getAllAppraisals);
router.put('/admin/appraisals/:id', validate({
  body: {
    appraisedValue: {
      amount: 'required|number',
      currency: 'string'
    },
    specifications: 'object',
    status: 'string|in:pending,in_progress,completed,cancelled',
    notes: 'string'
  }
}), serviceController.updateAppraisalDetails);

// Analytics
router.get('/analytics/appointments', serviceController.getAppointmentAnalytics);
router.get('/analytics/services', serviceController.getServiceAnalytics);
router.get('/analytics/appraisals', serviceController.getAppraisalAnalytics);

module.exports = router;