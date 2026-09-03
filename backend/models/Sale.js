const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  stockId: { type: String, default: '' },
  qty:     { type: Number, required: true },
  price:   { type: Number, required: true },
}, { _id: false });

const saleSchema = new mongoose.Schema({
  id:             { type: String, required: true, unique: true },
  source:         { type: String, default: '' },
  department:     { type: String, enum: ['restaurant', 'poolbar'], default: '' },
  items:          [saleItemSchema],
  subtotal:       { type: Number, default: 0 },
  discount:       { type: Number, default: 0 },
  total:          { type: Number, default: 0 },
  method:         { type: String, default: 'Cash' },
  staff:          { type: String, default: '' },
  table:          { type: String, default: '' },
  notes:          { type: String, default: '' },
  date:           { type: Date, default: Date.now },
  status:         { type: String, enum: ['completed', 'voided'], default: 'completed' },
  voidReason:     { type: String, default: '' },
  voidedBy:       { type: String, default: '' },
  voidDate:       { type: Date },
  roomNumber:     { type: String, default: null },
  guestName:      { type: String, default: null },
  guestPhone:     { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
