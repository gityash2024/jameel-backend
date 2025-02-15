
// models/setting.model.js
const settingSchema = new mongoose.Schema({
    group: {
      type: String,
      required: true,
      enum: ['general', 'payment', 'shipping', 'email', 'social', 'seo', 'store']
    },
    key: {
      type: String,
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    dataType: {
      type: String,
      required: true,
      enum: ['string', 'number', 'boolean', 'object', 'array']
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    description: String,
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }, {
    timestamps: true
  });
  
  // Compound index to ensure unique key per group
  settingSchema.index({ group: 1, key: 1 }, { unique: true });
  
  const Setting = mongoose.model('Setting', settingSchema);
  module.exports = Setting;