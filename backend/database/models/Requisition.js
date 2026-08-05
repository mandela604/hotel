/**
 * Grace Hotel — Requisition Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const requisitionItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  unit: { type: String, default: 'Units' },
  fulfillStore: String,
  supplier: String,
});

const requisitionSchema = new mongoose.Schema({
  reqNo: { type: String, required: true, unique: true, index: true },
  mode: { type: String, required: true, enum: ['store_issue','purchase'] },
  byName: { type: String, required: true },
  department: { type: String, required: true },
  needed: String,
  priority: { type: String, default: 'Normal', enum: ['Normal','Urgent','Emergency'] },
  fulfillStore: String,
  supplier: String,
  linked: String,
  remark: String,
  items: [requisitionItemSchema],
  status: { type: String, default: 'Pending', enum: ['Pending','Partial','Full','Rejected','Completed'] },
  dateRaised: { type: Date, required: true },
  dateDisplay: String,
});

basePlugin(requisitionSchema);

module.exports = mongoose.model('Requisition', requisitionSchema);