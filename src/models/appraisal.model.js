const appraisalSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    item: {
      type: {
        type: String,
        enum: ['ring', 'necklace', 'bracelet', 'earrings', 'watch', 'other'],
        required: true
      },
      description: String,
      photos: [{
        public_id: String,
        url: String
      }]
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    appraisedValue: {
      amount: Number,
      currency: {
        type: String,
        default: 'USD'
      }
    },
    appraiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    specifications: {
      metal: {
        type: String,
        purity: String,
        weight: Number
      },
      stones: [{
        type: String,
        weight: Number,
        quality: String,
        quantity: Number
      }],
      condition: String,
      age: String
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    notes: String,
    certificate: {
      number: String,
      issueDate: Date,
      expiryDate: Date,
      pdfUrl: String
    }
  }, {
    timestamps: true
  });
  
  const Appraisal = mongoose.model('Appraisal', appraisalSchema);
  
  module.exports = Appraisal;