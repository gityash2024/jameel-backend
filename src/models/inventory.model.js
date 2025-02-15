// models/inventory.model.js
const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant'
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative']
  },
  sku: {
    type: String,
    required: true,
    unique: true
  },
  location: {
    aisle: String,
    shelf: String,
    bin: String
  },
  lowStockAlert: {
    enabled: {
      type: Boolean,
      default: true
    },
    threshold: {
      type: Number,
      default: 5
    }
  },
  status: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'low_stock', 'discontinued'],
    default: 'in_stock'
  },
  lastStockUpdate: {
    date: Date,
    quantity: Number,
    type: {
      type: String,
      enum: ['add', 'remove', 'adjust'],
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

const Inventory = mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;