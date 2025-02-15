// models/collection.model.js
const mongoose = require('mongoose');
const slugify = require('slugify');

const collectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Collection name is required'],
    trim: true,
    maxLength: [100, 'Collection name cannot exceed 100 characters']
  },
  slug: String,
  description: {
    type: String,
    required: [true, 'Collection description is required']
  },
  image: {
    public_id: String,
    url: String,
    alt: String
  },
  banner: {
    public_id: String,
    url: String,
    alt: String
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  type: {
    type: String,
    enum: ['featured', 'seasonal', 'sale', 'new_arrival', 'limited_edition', 'exclusive'],
    default: 'featured'
  },
  startDate: Date,
  endDate: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  rules: {
    discountPercentage: Number,
    minimumPurchase: Number,
    maximumDiscount: Number
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
  timestamps: true
});

// Create slug before saving
collectionSchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

const Collection = mongoose.model('Collection', collectionSchema);
module.exports = Collection;
