const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxLength: [200, 'Product name cannot exceed 200 characters']
  },
  slug: String,
  sku: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    maxLength: [1000, 'Short description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['physical', 'digital']
  },
 // In productSchema, update the category and subCategories fields:

category: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Category',
  required: true
},
subcategory: {  // Changed from subCategories array to single subcategory
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Subcategory',
  required: true
},
  subCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  brand: {
    type: String,
    required: true
  },
 
  regularPrice: {
    type: Number,
    required: [true, 'Regular price is required'],
    min: [0, 'Price cannot be negative']
  },
  salePrice: {
    type: Number,
    min: [0, 'Sale price cannot be negative']
  },
  taxClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tax'
  },
  stockQuantity: {
    type: Number,
    required: true,
    min: [0, 'Stock quantity cannot be negative']
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  stockStatus: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'on_backorder'],
    default: 'in_stock'
  },
  images: [{
    public_id: String,
    url: String,
    alt: String,
    isPrimary: Boolean
  }],
  attributes: [{
    name: String,
    value: String
  }],
  variants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant'
  }],
  specifications: [{
    name: String,
    value: String
  }],
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'in'],
      default: 'cm'
    }
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['g', 'kg', 'lb', 'oz'],
      default: 'g'
    }
  },
  materials: [String],
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNewArrival: {
    type: Boolean,
    default: false
  },
  averageRating: {
    type: Number,
    default: 0,
    min: [0, 'Rating must be at least 0'],
    max: [5, 'Rating cannot exceed 5']
  },
  numberOfReviews: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug before saving
productSchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Virtual populate for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'product',
  localField: '_id'
});

// Index for search
productSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  'attributes.value': 'text'
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;