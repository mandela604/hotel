const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  role:       { type: String, required: true },
  dept:       { type: String, default: '' },
  shift:      { type: String, enum: ['Morning','Evening','Night'], default: 'Morning' },
  status:     { type: String, enum: ['on_duty','off_duty'], default: 'on_duty' },
  salary:     { type: Number, default: 0 },
  privileges: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
