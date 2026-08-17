const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  qty:   { type: Number, default: 0 },
  unit:  { type: String, default: 'Units' },
  cost:  { type: Number, default: 0 },
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  poNo:        { type: String, required: true, unique: true },
  prNo:        { type: String, default: '' },
  supplier:    { type: String, default: '' },
  items:       [poItemSchema],
  totalAmount: { type: Number, default: 0 },
  status:      { type: String, enum: ['pending','sent','partial','fulfilled','cancelled'], default: 'pending' },
  createdBy:   { type: String, default: '' },
  dateCreated: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
