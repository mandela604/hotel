const mongoose = require('mongoose');

const reqItemSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  unit:      { type: String, default: 'Pieces' },
  qty:       { type: Number, default: 0 },
  cost:      { type: Number, default: 0 },
  remark:    { type: String, default: '' },
  issuedQty: { type: Number, default: 0 },
}, { _id: false });

const requisitionSchema = new mongoose.Schema({
  requisitionNo: { type: String, required: true, unique: true },
  mode:          { type: String, enum: ['store_issue','purchase'], default: 'store_issue' },
  requester:     { type: String, required: true },
  dept:          { type: String, required: true },
  neededBy:      { type: String, default: '' },
  priority:      { type: String, enum: ['Normal','Urgent'], default: 'Normal' },
  remark:        { type: String, default: '' },
  supplier:      { type: String, default: '' },
  linked:        { type: String, default: '' },
  items:         [reqItemSchema],
  status:        { type: String, enum: ['Pending','Partial','Full','Rejected'], default: 'Pending' },
  rejectReason:  { type: String, default: '' },
  dateRaised:    { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Requisition', requisitionSchema);
