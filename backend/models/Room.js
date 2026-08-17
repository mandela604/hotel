const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  type:   { type: String, enum: ['Standard','Deluxe','Suite','Conference'], required: true },
  rate:   { type: Number, default: 0 },
  status: { type: String, enum: ['available','occupied','maintenance','reserved'], default: 'available' },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
