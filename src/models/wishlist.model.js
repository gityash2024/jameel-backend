const mongoose = require('mongoose');
const wishlistSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    products: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }, {
    timestamps: true
  });
  
  const Wishlist = mongoose.model('Wishlist', wishlistSchema);
  
  module.exports = Wishlist;