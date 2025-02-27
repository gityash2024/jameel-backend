const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true
  },
  branchCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  zipCode: {
    type: String,
    required: [true, 'Zip code is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required']
  },
  hours: {
    type: String,
    required: [true, 'Store hours are required']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image: {
    type: String
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 4.5
  },
  reviews: {
    type: Number,
    default: 0
  },
  features: [{
    type: String,
    enum: ['Parking', 'Wheelchair Access', 'Private Viewing Room', 'Custom Design', 'Repairs']
  }]
}, {
  timestamps: true
});

// Create a 2dsphere index for geospatial queries
storeSchema.index({ location: '2dsphere' });

const Store = mongoose.model('Store', storeSchema);
module.exports = Store;