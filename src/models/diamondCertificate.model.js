// models/diamondCertificate.model.js
const diamondCertificateSchema = new mongoose.Schema({
    certificateNumber: {
      type: String,
      required: true,
      unique: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    issuingAuthority: {
      type: String,
      enum: ['GIA', 'IGI', 'AGS', 'HRD'],
      required: true
    },
    specifications: {
      shape: String,
      carat: Number,
      color: String,
      clarity: String,
      cut: String,
      polish: String,
      symmetry: String,
      fluorescence: String,
      measurements: {
        length: Number,
        width: Number,
        depth: Number
      },
      depthPercentage: Number,
      tablePercentage: Number
    },
    issueDate: Date,
    pdfUrl: String,
    isVerified: {
      type: Boolean,
      default: false
    }
  }, {
    timestamps: true
  });
  
  const DiamondCertificate = mongoose.model('DiamondCertificate', diamondCertificateSchema);
  
  module.exports = DiamondCertificate;