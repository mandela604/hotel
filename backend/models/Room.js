const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  num:   { type: String, required: true, unique: true },
  type:  { type: String, enum: ['Standard','Deluxe','Suite','Conference'], required: true },
  rate:  { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
