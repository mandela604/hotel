const mongoose = require('mongoose');

const gymCheckinSchema = new mongoose.Schema({
  member:   { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember', required: true },
  name:     { type: String, required: true },
  date:     { type: Date, default: Date.now },
  time:     { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('GymCheckin', gymCheckinSchema);
