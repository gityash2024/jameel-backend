const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true
  },
  branchCode: {
    type: String,
    required: true,
    unique: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
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
  contactInfo: {
    phone: String,
    email: String,
    website: String
  },
  operatingHours: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    open: String,
    close: String,
    isOpen: {
      type: Boolean,
      default: true
    }
  }],
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  staff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  images: [{
    public_id: String,
    url: String
  }],
  features: [{
    type: String,
    enum: ['parking', 'wifi', 'handicap_accessible', 'appointment_only']
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'temporarily_closed', 'permanently_closed'],
    default: 'active'
  },
  ratings: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory'
  }
}, {
  timestamps: true
});

// Index for geospatial queries
storeSchema.index({ location: '2dsphere' });

const Store = mongoose.model('Store', storeSchema);
module.exports = Store;