/**
 * Grace Hotel — Sale Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const saleItemSchema = new mongoose.Schema({
  id: { type: String, default: () => require('uuid').v4() },
  name: { type: String, required: true },
  qty: { type: Number, default: 1 },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
});

const saleSchema = new mongoose.Schema({
  department: { type: String, required: true, enum: ['restaurant','poolbar','store','gym'] },
  items: [saleItemSchema],
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  method: { type: String, enum: ['Cash','Card','Room Charge','Transfer','POS'] },
  staffId: String,
  tableNumber: Number,
  guestName: String,
  notes: String,
  status: { type: String, default: 'completed', enum: ['completed','voided','refunded'] },
  voidReason: String,
  voidedBy: String,
  voidedAt: Date,
});

basePlugin(saleSchema);

module.exports = mongoose.model('Sale', saleSchema);