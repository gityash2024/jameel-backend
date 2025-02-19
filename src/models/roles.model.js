// src/models/role.model.js (not roles.model.js)
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,

  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'update', 'delete','all']

  }]
}, {
  timestamps: true
});

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;