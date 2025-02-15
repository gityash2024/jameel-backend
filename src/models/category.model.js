const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxLength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: String,
  description: {
    type: String,
    required: [true, 'Category description is required']
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  image: {
    public_id: String,
    url: String,
    alt: String
  },
  icon: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  showInMenu: {
    type: Boolean,
    default: true
  },
  menuOrder: {
    type: Number,
    default: 0
  },
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

categorySchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

categorySchema.virtual('products', {
  ref: 'Product',
  foreignField: 'category',
  localField: '_id'
});

categorySchema.virtual('subcategories', {
  ref: 'Category',
  foreignField: 'parent',
  localField: '_id'
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
