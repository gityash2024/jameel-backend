
// models/giftCard.model.js
const giftCardSchema = new mongoose.Schema({
    code: {
      type: String,
      required: true,
      unique: true
    },
    initialBalance: {
      type: Number,
      required: true,
      min: [0, 'Balance cannot be negative']
    },
    currentBalance: {
      type: Number,
      required: true,
      min: [0, 'Balance cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD'
    },
    expiryDate: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    purchasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recipient: {
      name: String,
      email: String,
      message: String
    },
    transactions: [{
      type: {
        type: String,
        enum: ['purchase', 'redeem', 'refund']
      },
      amount: Number,
      date: Date,
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      }
    }]
  }, {
    timestamps: true
  });
  
  const GiftCard = mongoose.model('GiftCard', giftCardSchema);
  
  module.exports = GiftCard;
  