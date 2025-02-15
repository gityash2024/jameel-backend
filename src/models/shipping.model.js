
const mongoose = require('mongoose');
// models/shipping.model.js
const shippingSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    carrier: {
      type: String,
      required: true
    },
    method: {
      type: String,
      required: true,
      enum: ['standard', 'express', 'overnight', 'international']
    },
    zones: [{
      name: String,
      countries: [String],
      states: [String],
      rates: [{
        minWeight: Number,
        maxWeight: Number,
        price: Number
      }]
    }],
    restrictions: {
      maxWeight: Number,
      maxDimensions: {
        length: Number,
        width: Number,
        height: Number
      },
      restrictedCountries: [String],
      requiresSignature: Boolean,
      isInsured: Boolean
    },
    estimatedDays: {
      min: Number,
      max: Number
    },
    isActive: {
      type: Boolean,
      default: true
    },
    tracking: {
      available: Boolean,
      provider: String,
      urlTemplate: String
    },
    conditions: {
      minOrderAmount: Number,
      freeShippingThreshold: Number,
      additionalFees: [{
        name: String,
        amount: Number,
        type: {
          type: String,
          enum: ['fixed', 'percentage']
        }
      }]
    }
  }, {
    timestamps: true
  });
  
  const Shipping = mongoose.model('Shipping', shippingSchema);
  
  module.exports = Shipping;
  