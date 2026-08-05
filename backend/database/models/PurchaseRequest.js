/**
 * Grace Hotel — PurchaseRequest Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const purchaseRequestSchema = new mongoose.Schema({
  prNo: { type: String, required: true, unique: true, index: true },
  item: { type: String, required: true },
  category: String,
  department: String,
  requestedById: String,
  qty: { type: Number, default: 1 },
  unit: { type: String, default: 'Units' },
  unitCost: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  priority: { type: String, default: 'Normal' },
  notes: String,
  approvalStage: { type: String, default: 'pending', enum: ['pending','accountant','gm','md','approved','rejected','fulfilled'] },
  status: { type: String, default: 'pending' },
  supplier: String,
  poNo: String,
  history: mongoose.Schema.Types.Mixed,
});

basePlugin(purchaseRequestSchema);

module.exports = mongoose.model('PurchaseRequest', purchaseRequestSchema);