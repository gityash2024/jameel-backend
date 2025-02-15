// models/media.model.js
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['image', 'video', 'document']
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  public_id: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  alt: String,
  caption: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usage: [{
    model: String,
    documentId: mongoose.Schema.Types.ObjectId
  }],
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    tags: [String]
  },
  folder: {
    type: String,
    default: 'general'
  }
}, {
  timestamps: true
});

const Media = mongoose.model('Media', mediaSchema);

module.exports = Media;