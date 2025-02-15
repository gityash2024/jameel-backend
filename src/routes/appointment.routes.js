// src/routes/appointment.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const appointmentController = require('../controllers/appointment.controller');

// All routes require authentication
router.use(authenticate);

// Customer routes
router.get('/my-appointments', appointmentController.getMyAppointments);
router.get('/my-appointments/:id', appointmentController.getAppointmentById);

router.post('/', validate({
  body: {
    serviceId: 'required|string',
    storeId: 'required|string',
    appointmentDate: 'required|date',
    timeSlot: {
      startTime: 'required|string',
      endTime: 'required|string'
    },
    serviceDetails: 'object',
    specialRequests: 'string'
  }
}), appointmentController.createAppointment);

router.put('/:id', validate({
  body: {
    appointmentDate: 'date',
    timeSlot: 'object',
    specialRequests: 'string'
  }
}), appointmentController.updateAppointment);

router.delete('/:id', appointmentController.cancelAppointment);

// Get available time slots
router.get('/available-slots', validate({
  query: {
    serviceId: 'required|string',
    storeId: 'required|string',
    date: 'required|date'
  }
}), appointmentController.getAvailableTimeSlots);

// Staff/Admin routes
router.use(authorize(['admin', 'staff']));

router.get('/', appointmentController.getAllAppointments);
router.get('/calendar', appointmentController.getAppointmentCalendar);
router.get('/store/:storeId', appointmentController.getStoreAppointments);

router.put('/:id/status', validate({
  body: {
    status: 'required|string|in:scheduled,confirmed,completed,cancelled,no_show'
  }
}), appointmentController.updateAppointmentStatus);

router.put('/:id/assign', validate({
  body: {
    staffId: 'required|string'
  }
}), appointmentController.assignStaffToAppointment);

// Reminder management
router.post('/:id/send-reminder', appointmentController.sendAppointmentReminder);
router.put('/:id/reminder-settings', validate({
  body: {
    isEnabled: 'boolean',
    timing: 'array'
  }
}), appointmentController.updateReminderSettings);

// Analytics and reporting
router.get('/analytics/overview', appointmentController.getAppointmentAnalytics);
router.get('/analytics/staff-utilization', appointmentController.getStaffUtilizationAnalytics);
router.get('/analytics/service-demand', appointmentController.getServiceDemandAnalytics);

module.exports = router;