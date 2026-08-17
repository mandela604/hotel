const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  room:       { type: String, required: true },
  type:       { type: String, default: 'Standard' },
  guest:      { type: String, required: true },
  phone:      { type: String, default: '' },
  email:      { type: String, default: '' },
  idType:     { type: String, default: '' },
  idNum:      { type: String, default: '' },
  checkIn:    { type: Date, required: true },
  checkOut:   { type: Date },
  rate:       { type: Number, default: 0 },
  discount:   { type: Number, default: 0 },
  paid:       { type: Number, default: 0 },
  payMethod:  { type: String, default: 'Cash' },
  payStatus:  { type: String, enum: ['Paid','Unpaid','Partial'], default: 'Unpaid' },
  recordedBy: { type: String, default: '' },
  adults:     { type: Number, default: 1 },
  children:   { type: Number, default: 0 },
  status:     { type: String, enum: ['Checked In','Checked Out','Reserved','Cancelled'], default: 'Checked In' },
  notes:      { type: String, default: '' },
  nights:     { type: Number, default: 1 },
  amount:     { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
