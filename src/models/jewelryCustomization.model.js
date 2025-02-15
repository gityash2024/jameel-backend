
// models/jewelryCustomization.model.js
const jewelryCustomizationSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['ring', 'necklace', 'bracelet', 'earrings', 'other'],
      required: true
    },
    baseProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    specifications: {
      metal: {
        type: String,
        enum: ['gold_14k', 'gold_18k', 'platinum', 'silver'],
        required: true
      },
      metalColor: {
        type: String,
        enum: ['yellow', 'white', 'rose'],
        required: true
      },
      size: String,
      stones: [{
        type: String,
        cut: String,
        color: String,
        clarity: String,
        carat: Number,
        position: String
      }],
      engraving: {
        text: String,
        font: String,
        position: String
      }
    },
    designImages: [{
      public_id: String,
      url: String,
      description: String
    }],
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'in_production', 'completed', 'cancelled'],
      default: 'draft'
    },
    price: {
      estimation: Number,
      final: Number
    },
    notes: String,
    timeline: [{
      stage: String,
      date: Date,
      notes: String
    }]
  }, {
    timestamps: true
  });
  
  const JewelryCustomization = mongoose.model('JewelryCustomization', jewelryCustomizationSchema);
  
  module.exports = JewelryCustomization;