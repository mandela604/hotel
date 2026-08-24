const mongoose = require('mongoose');

const poolbarOrderItemSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  qty:   { type: Number, required: true },
  price: { type: Number, required: true },
}, { _id: false });

const poolbarOrderSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true },
  items:        [poolbarOrderItemSchema],
  subtotal:     { type: Number, default: 0 },
  discount:     { type: Number, default: 0 },
  total:        { type: Number, default: 0 },
  staff:        { type: String, default: '' },
  table:        { type: String, default: '' },
  notes:        { type: String, default: '' },
  date:         { type: Date, default: Date.now },
  status:       { type: String, enum: ['open', 'served', 'paid', 'cancelled'], default: 'open' },
  source:       { type: String, default: 'tab' },
  roomNumber:   { type: String, default: null },
  guestName:    { type: String, default: null },
  guestPhone:   { type: String, default: null },
  payMethod:    { type: String, default: '' },
  paidSaleId:   { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('PoolbarOrder', poolbarOrderSchema);
