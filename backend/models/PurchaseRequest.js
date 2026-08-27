const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const prHistorySchema = new mongoose.Schema({
  date:   { type: String, default: '' },
  action: { type: String, default: '' },
  by:     { type: String, default: '' },
  note:   { type: String, default: '' },
  stage:  { type: String, default: '' },
}, { _id: false });

// Same shape as poItemSchema in PurchaseOrder.js — kept local rather than
// shared so this file has no cross-model import, matching the rest of
// the codebase's one-model-per-file style.
const prItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty:  { type: Number, default: 0 },
  unit: { type: String, default: 'Units' },
  cost: { type: Number, default: 0 },
}, { _id: false });

const purchaseRequestSchema = new mongoose.Schema({
  id:              { type: String, default: uuidv4, unique: true, index: true },
  prNo:            { type: String, required: true, unique: true },
  poNo:            { type: String, default: '' },
  item:            { type: String, required: true },
  cat:             { type: String, default: 'General' },
  dept:            { type: String, default: '' },
  // Who raised this PR — 'Store' for anything imported via
  // POST /procurement/incoming-store-requests/:no/import, 'Procurement'
  // for everything created directly on po-form.html. Independent of
  // `dept` (which department the goods are FOR).
  source:          { type: String, enum: ['Store', 'Procurement'], default: 'Procurement' },
  // Set only when source:'Store' — the originating Requisition's
  // requisitionNo, so the PR can always be traced back to what Store
  // actually asked for.
  storeReqNo:      { type: String, default: '' },
  by:              { type: String, default: '' },
  date:            { type: Date, default: Date.now },
  needed:          { type: String, default: '' },
  qty:             { type: Number, default: 1 },
  unit:            { type: String, default: 'Units' },
  unitCost:        { type: Number, default: 0 },
  totalAmount:     { type: Number, default: 0 },
  priority:        { type: String, enum: ['Normal', 'Urgent'], default: 'Normal' },
  approvalStage:   { type: String, enum: ['pending', 'accountant', 'gm', 'md', 'approved', 'sent_to_store', 'rejected', 'fulfilled', 'voided'], default: 'pending' },
  status:          { type: String, default: 'pending' },
  needsMDApproval: { type: Boolean, default: false },
  supplier:        { type: String, default: '' },
  notes:           { type: String, default: '' },
  rejectReason:    { type: String, default: '' },
  voidReason:      { type: String, default: '' },
  correctionOfPrId:{ type: String, default: '' },
  voidedIntoPrId:  { type: String, default: '' },
  // Line items — what po-form.html's item-entry table actually edits.
  // Missing from the original schema (only the singular item/qty/unitCost
  // legacy fields existed), which is why totals/pricing had nowhere real
  // to persist on the backend.
  items:           { type: [prItemSchema], default: [] },
  history:         [prHistorySchema],
}, { timestamps: true });

module.exports = mongoose.model('PurchaseRequest', purchaseRequestSchema);