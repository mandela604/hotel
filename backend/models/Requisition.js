const mongoose = require('mongoose');

const reqItemSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  stockId:   { type: String, default: '' },
  unit:      { type: String, default: 'Pieces' },
  qty:       { type: Number, default: 0 },
  cost:      { type: Number, default: 0 },
  remark:    { type: String, default: '' },
  issuedQty: { type: Number, default: 0 },
}, { _id: false });

const requisitionSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  requisitionNo: { type: String, required: true, unique: true },
  mode:          { type: String, enum: ['store_issue', 'purchase'], default: 'store_issue' },
  requester:     { type: String, required: true },
  dept:          { type: String, required: true },
  neededBy:      { type: String, default: '' },
  priority:      { type: String, enum: ['Normal', 'Urgent'], default: 'Normal' },
  remark:        { type: String, default: '' },
  fulfillStore: { type: String, default: null },
  supplier:      { type: String, default: '' },
  linked:        { type: String, default: '' },
  items:         [reqItemSchema],
  status: {
      type: String,
      enum: ['Pending', 'Partial', 'Full', 'Rejected', 'Completed', 'Disputed'],
      default: 'Pending',
    },  
  rejectReason:  { type: String, default: '' },
  dateRaised:    { type: Date, default: Date.now },
  // Set once a mode:'purchase' requisition has been pulled into
  // Procurement by POST /procurement/incoming-store-requests/:no/import.
  // Presence of procurementPrId is the "already imported" marker — kept
  // as a plain flag rather than adding a new status enum value, so the
  // existing Pending/Partial/Full/Rejected lifecycle (which really
  // belongs to mode:'store_issue') doesn't need to change meaning.
  procurementPrId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseRequest', default: null },
  procurementPrNo: { type: String, default: '' },
  dateRaisedDisplay: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Requisition', requisitionSchema);