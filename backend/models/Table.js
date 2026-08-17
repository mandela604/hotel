const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  number:     { type: Number, required: true, unique: true },
  seats:      { type: Number, default: 4 },
  status:     { type: String, enum: ['available','occupied','reserved'], default: 'available' },
  waiter:     { type: String, default: '' },
  orderTotal: { type: Number, default: 0 },
  guest:      { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
