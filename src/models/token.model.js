
  // models/token.model.js
  const mongoose = require('mongoose');

  const tokenSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['email_verification', 'password_reset', 'refresh_token', 'api_token']
    },
    token: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isUsed: {
      type: Boolean,
      default: false
    },
    createdByIp: String,
    lastUsedAt: Date,
    revokedAt: Date,
    revokedByIp: String,
    replacedByToken: String,
    metadata: {
      type: Map,
      of: String
    }
  }, {
    timestamps: true
  });
  
  // Index for quick token lookups and cleanup
  tokenSchema.index({ token: 1 });
  tokenSchema.index({ user: 1, type: 1 });
  tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  const Token = mongoose.model('Token', tokenSchema);
  module.exports = Token;
  