// models/notification.model.js
const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['order', 'appointment', 'promotion', 'system', 'payment'],
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    isRead: {
      type: Boolean,
      default: false
    },
    redirectUrl: String,
    metadata: {
      type: Map,
      of: String
    }
  }, {
    timestamps: true
  });
  
  const Notification = mongoose.model('Notification', notificationSchema);
  
  module.exports = Notification;