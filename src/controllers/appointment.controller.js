// src/controllers/appointment.controller.js
const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const Service = require('../models/services.model');
const Store = require('../models/store.model');
const { sendEmail } = require('../services/email.service');
const { sendSms } = require('../services/sms.service');
const { createNotification } = require('../services/notification.service');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const DateTimeUtil = require('../utils/dateTime');

exports.createAppointment = catchAsync(async (req, res) => {
  const {
    service,
    store,
    appointmentDate,
    timeSlot,
    serviceDetails,
    specialRequests
  } = req.body;

  // Check if service exists
  const serviceExists = await Service.findById(service);
  if (!serviceExists) {
    throw new AppError('Service not found', 404);
  }

  // Check if store exists
  const storeExists = await Store.findById(store);
  if (!storeExists) {
    throw new AppError('Store not found', 404);
  }

  // Check if time slot is available
  const isSlotAvailable = await checkTimeSlotAvailability(
    store,
    appointmentDate,
    timeSlot
  );
  if (!isSlotAvailable) {
    throw new AppError('Selected time slot is not available', 400);
  }

  // Create appointment
  const appointment = await Appointment.create({
    user: req.user._id,
    service,
    store,
    appointmentDate,
    timeSlot,
    serviceDetails,
    specialRequests,
    status: 'scheduled'
  });

  // Send confirmation email
  await sendEmail(req.user.email, 'Appointment Confirmation', 'appointment-confirmation', {
    appointment,
    user: req.user
  });

  // Send SMS notification if phone number exists
  if (req.user.phone) {
    await sendSms(req.user.phone, `Your appointment has been scheduled for ${DateTimeUtil.formatDate(appointmentDate)} at ${timeSlot.startTime}`);
  }

  // Create notification
  await createNotification(
    req.user._id,
    'appointment',
    'Appointment Scheduled',
    `Your appointment has been scheduled for ${DateTimeUtil.formatDate(appointmentDate)}`
  );

  res.status(201).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

exports.getStoreAppointments = catchAsync(async (req, res, next) => {
  const { storeId } = req.params;

  const appointments = await Appointment.find({ store: storeId })
    .populate('user')
    .populate('service')
    .populate('store')
    .populate('staff')
    .sort({ appointmentDate: -1 });

  res.status(200).json({
    status: 'success',
    data: {
      appointments
    }
  });
});

exports.sendAppointmentReminder = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const appointment = await Appointment.findById(id)
    .populate('user')
    .populate('service')
    .populate('store');

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Implement logic to send appointment reminder
  // ...

  res.status(200).json({
    status: 'success',
    message: 'Appointment reminder sent successfully'
  });
});

exports.updateReminderSettings = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isEnabled, timing } = req.body;

  const appointment = await Appointment.findById(id);

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  appointment.reminder.isEnabled = isEnabled;
  appointment.reminder.timing = timing;
  await appointment.save();

  res.status(200).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

exports.getMyAppointments = catchAsync(async (req, res) => {
  const appointments = await Appointment.find({ user: req.user._id })
    .populate('service')
    .populate('store')
    .sort({ appointmentDate: -1 });

  res.status(200).json({
    status: 'success',
    data: {
      appointments
    }
  });
});

exports.getAppointmentById = catchAsync(async (req, res) => {
  const appointment = await Appointment.findOne({
    _id: req.params.id,
    user: req.user._id
  })
    .populate('service')
    .populate('store')
    .populate('staff');

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

exports.updateAppointment = catchAsync(async (req, res) => {
  const {
    appointmentDate,
    timeSlot,
    specialRequests
  } = req.body;

  const appointment = await Appointment.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.status !== 'scheduled') {
    throw new AppError('Cannot update confirmed or completed appointment', 400);
  }

  if (appointmentDate && timeSlot) {
    const isSlotAvailable = await checkTimeSlotAvailability(
      appointment.store,
      appointmentDate,
      timeSlot,
      appointment._id
    );
    if (!isSlotAvailable) {
      throw new AppError('Selected time slot is not available', 400);
    }
  }

  appointment.appointmentDate = appointmentDate || appointment.appointmentDate;
  appointment.timeSlot = timeSlot || appointment.timeSlot;
  appointment.specialRequests = specialRequests || appointment.specialRequests;

  await appointment.save();

  // Send update notification
  await createNotification(
    req.user._id,
    'appointment',
    'Appointment Updated',
    `Your appointment has been updated to ${DateTimeUtil.formatDate(appointment.appointmentDate)}`
  );

  res.status(200).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

exports.cancelAppointment = catchAsync(async (req, res) => {
  const appointment = await Appointment.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.status !== 'scheduled') {
    throw new AppError('Cannot cancel confirmed or completed appointment', 400);
  }

  appointment.status = 'cancelled';
  appointment.cancelReason = req.body.cancelReason;
  await appointment.save();

  // Send cancellation email
  await sendEmail(req.user.email, 'Appointment Cancelled', 'appointment-cancellation', {
    appointment,
    user: req.user
  });

  // Create notification
  await createNotification(
    req.user._id,
    'appointment',
    'Appointment Cancelled',
    'Your appointment has been cancelled'
  );

  res.status(200).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

exports.getAvailableTimeSlots = catchAsync(async (req, res) => {
  const { serviceId, storeId, date } = req.query;

  const store = await Store.findById(storeId);
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const service = await Service.findById(serviceId);
  if (!service) {
    throw new AppError('Service not found', 404);
  }

  const timeSlots = await generateAvailableTimeSlots(store, service, date);

  res.status(200).json({
    status: 'success',
    data: {
      timeSlots
    }
  });
});

// Admin/Staff Routes

exports.getAllAppointments = catchAsync(async (req, res) => {
  const appointments = await Appointment.find()
    .populate('user')
    .populate('store')
    .sort({ appointmentDate: -1 });

  res.status(200).json({
    status: 'success',
    data: {
      appointments
    }
  });
});

exports.getAppointmentCalendar = catchAsync(async (req, res) => {
  const { startDate, endDate, storeId } = req.query;

  const query = {
    appointmentDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (storeId) {
    query.store = storeId;
  }

  const appointments = await Appointment.find(query)
    .populate('user')
    .sort({ appointmentDate: -1 });

  res.status(200).json({
    status: 'success',
    data: {
      appointments
    }
  });
});

exports.updateAppointmentStatus = catchAsync(async (req, res) => {
  const { status } = req.body;

  const appointment = await Appointment.findById(req.params.id)
    .populate('user');

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  appointment.status = status;
  await appointment.save();

  // Send status update notification
  await createNotification(
    appointment.user._id,
    'appointment',
    'Appointment Status Updated',
    `Your appointment status has been updated to ${status}`
  );

  // Send email notification
  await sendEmail(
    appointment.user.email,
    'Appointment Status Update',
    'appointment-status-update',
    {
      appointment,
      user: appointment.user
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

exports.assignStaffToAppointment = catchAsync(async (req, res) => {
  const { staffId } = req.body;

  const staff = await User.findOne({
    _id: staffId,
    role: 'staff'
  });

  if (!staff) {
    throw new AppError('Staff member not found', 404);
  }

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  appointment.staff = staffId;
  await appointment.save();

  res.status(200).json({
    status: 'success',
    data: {
      appointment
    }
  });
});

// Helper functions

const checkTimeSlotAvailability = async (storeId, date, timeSlot, excludeAppointmentId = null) => {
  const query = {
    store: storeId,
    appointmentDate: DateTimeUtil.formatDate(date),
    'timeSlot.startTime': timeSlot.startTime,
    'timeSlot.endTime': timeSlot.endTime,
    status: { $nin: ['cancelled', 'no_show'] }
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const existingAppointment = await Appointment.findOne(query);
  return !existingAppointment;
};

const generateAvailableTimeSlots = async (store, service, date) => {
  const businessHours = store.operatingHours.find(
    hours => hours.day === DateTimeUtil.formatDate(date, 'dddd')
  );

  if (!businessHours || !businessHours.isOpen) {
    return [];
  }

  const slots = [];
  let currentTime = DateTimeUtil.parseTime(businessHours.open);
  const closeTime = DateTimeUtil.parseTime(businessHours.close);
  const duration = service.duration;

  while (DateTimeUtil.addMinutes(currentTime, duration) <= closeTime) {
    const timeSlot = {
      startTime: DateTimeUtil.formatTime(currentTime),
      endTime: DateTimeUtil.formatTime(DateTimeUtil.addMinutes(currentTime, duration))
    };

    const isAvailable = await checkTimeSlotAvailability(store._id, date, timeSlot);
    if (isAvailable) {
      slots.push(timeSlot);
    }

    currentTime = DateTimeUtil.addMinutes(currentTime, duration);
  }

  return slots;
};

// Analytics

exports.getAppointmentAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const stats = await Appointment.aggregate([
    {
      $match: {
        appointmentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

exports.getStaffUtilizationAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const utilization = await Appointment.aggregate([
    {
      $match: {
        appointmentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        staff: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$staff',
        appointmentCount: { $sum: 1 },
        completedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'staffInfo'
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      utilization
    }
  });
});

exports.getServiceDemandAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const demand = await Appointment.aggregate([
    {
      $match: {
        appointmentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$service',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'services',
        localField: '_id',
        foreignField: '_id',
        as: 'serviceInfo'
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      demand
    }
  });
});

// Add custom design appointment handler
exports.createCustomDesignAppointment = catchAsync(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    productType,
    stoneType,
    stoneColor,
    carat,
    metalType,
    message,
    appointmentDate,
    appointmentTime,
    shoppingFor,
    isSpecialOccasion,
    storeId
  } = req.body;

  // Check if store exists
  if (storeId) {
    const storeExists = await Store.findById(storeId);
    if (!storeExists) {
      throw new AppError('Store not found', 404);
    }
  }

  // Create appointment
  const appointment = await Appointment.create({
    firstName,
    lastName,
    email,
    phone,
    productType,
    stoneType,
    stoneColor,
    carat,
    metalType,
    message,
    appointmentDate,
    appointmentTime,
    shoppingFor,
    isSpecialOccasion,
    store: storeId,
    status: 'pending',
    user: req.user ? req.user._id : null
  });

  // Send confirmation email
  await sendEmail(email, 'Custom Design Appointment Confirmation', 'custom-design-confirmation', {
    appointment,
    user: req.user
  });

  // Send SMS notification if phone number exists
  if (phone) {
    const formattedDate = new Date(appointmentDate).toLocaleDateString();
    await sendSms(phone, `Your custom design appointment has been scheduled for ${formattedDate} at ${appointmentTime}`);
  }

  // Create notification if user is logged in
  if (req.user) {
    await createNotification(
      req.user._id,
      'appointment',
      'Custom Design Appointment Scheduled',
      `Your custom design appointment has been scheduled for ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}`
    );
  }

  res.status(201).json({
    status: 'success',
    data: {
      appointment
    }
  });
});