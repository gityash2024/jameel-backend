
// models/service.model.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Service description is required']
  },
  category: {
    type: String,
    required: true,
    enum: ['repair', 'maintenance', 'customization', 'appraisal', 'engraving', 'other']
  },
  duration: {
    type: Number,
    required: true,
    min: [1, 'Duration must be at least 1 minute']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  requiredFields: [{
    name: String,
    type: String,
    required: Boolean
  }],
  availableTimeSlots: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    slots: [{
      startTime: String,
      endTime: String,
      maxBookings: Number
    }]
  }],
  image: {
    public_id: String,
    url: String
  }
}, {
  timestamps: true
});

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;