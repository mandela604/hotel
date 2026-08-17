const mongoose = require('mongoose');

const prHistorySchema = new mongoose.Schema({
  date:   { type: String, default: '' },
  action: { type: String, default: '' },
  by:     { type: String, default: '' },
  stage:  { type: String, default: '' },
}, { _id: false });

const purchaseRequestSchema = new mongoose.Schema({
  prNo:            { type: String, required: true, unique: true },
  item:            { type: String, required: true },
  cat:             { type: String, default: 'General' },
  dept:            { type: String, default: '' },
  by:              { type: String, default: '' },
  date:            { type: Date, default: Date.now },
  needed:          { type: String, default: '' },
  qty:             { type: Number, default: 1 },
  unit:            { type: String, default: 'Units' },
  unitCost:        { type: Number, default: 0 },
  totalAmount:     { type: Number, default: 0 },
  priority:        { type: String, enum: ['Normal','Urgent'], default: 'Normal' },
  approvalStage:   { type: String, enum: ['pending','accountant','gm','md','approved','rejected','fulfilled'], default: 'pending' },
  status:          { type: String, default: 'pending' },
  needsMDApproval: { type: Boolean, default: false },
  supplier:        { type: String, default: '' },
  poNo:            { type: String, default: '' },
  notes:           { type: String, default: '' },
  history:         [prHistorySchema],
}, { timestamps: true });

module.exports = mongoose.model('PurchaseRequest', purchaseRequestSchema);
