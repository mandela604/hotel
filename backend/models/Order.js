const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  qty:   { type: Number, required: true },
  price: { type: Number, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id:             { type: String, required: true, unique: true },
  department:     { type: String, enum: ['restaurant', 'poolbar'], default: 'restaurant' },
  items:          [orderItemSchema],
  subtotal:       { type: Number, default: 0 },
  discount:       { type: Number, default: 0 },
  total:          { type: Number, default: 0 },
  staff:          { type: String, default: '' },
  table:          { type: String, default: '' },
  notes:          { type: String, default: '' },
  date:           { type: Date, default: Date.now },
  status:         { type: String, enum: ['open', 'served', 'paid', 'cancelled'], default: 'open' },
  method:         { type: String, default: null },
  payMethod:      { type: String, default: null },
  roomNumber:     { type: String, default: null },
  guestName:      { type: String, default: null },
  guestPhone:     { type: String, default: null },
  paidSaleId:     { type: String, default: null },
  createdBy:      { type: String, default: '' },
  processedBy:    { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
