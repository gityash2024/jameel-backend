
// models/subcategory.model.js
const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subcategory name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category ID is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
subcategorySchema.index({ category: 1 });

// Middleware to check if category exists before saving
subcategorySchema.pre('save', async function(next) {
  try {
    const Category = mongoose.model('Category');
    const categoryExists = await Category.findById(this.category);
    
    if (!categoryExists) {
      throw new Error('Category does not exist');
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

const Subcategory = mongoose.model('Subcategory', subcategorySchema);
module.exports = Subcategory;
