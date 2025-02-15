const Notification = require('../models/notification.model');
const { NOTIFICATION_TYPES } = require('../constants');

const createNotification = async (userId, type, title, message, metadata = {}) => {
  const notification = new Notification({
    user: userId,
    type,
    title,
    message,
    metadata
  });

  await notification.save();
};

const getNotifications = async (userId, limit = 10, page = 1) => {
  const notifications = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .exec();

  return notifications;
};

const markAsRead = async (notificationId) => {
  await Notification.findByIdAndUpdate(notificationId, { isRead: true });
};

const sendOrderNotification = async (userId, orderId, status) => {
  const title = 'Order Update';
  const message = `Your order (${orderId}) status has been updated to ${status}.`;

  await createNotification(userId, NOTIFICATION_TYPES.ORDER, title, message, { orderId });
};

const sendAppointmentNotification = async (userId, appointmentId, status) => {
  const title = 'Appointment Update';
  const message = `Your appointment (${appointmentId}) status has been updated to ${status}.`;

  await createNotification(userId, NOTIFICATION_TYPES.APPOINTMENT, title, message, { appointmentId });
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  sendOrderNotification,
  sendAppointmentNotification
};