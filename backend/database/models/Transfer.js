/**
 * Grace Hotel — Transfer Model (Inter-Department Inventory Transfers)
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const transferSchema = new mongoose.Schema({
  no: { type: String, required: true, unique: true, index: true }, // e.g. "KT-1042"
  fromDept: { type: String, required: true, default: 'Kitchen' },
  toDept: { type: String, required: true, default: 'Restaurant' },
  meal: { type: String, required: true }, // item name
  qty: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'plates' },
  sender: String,
  receivedBy: String,
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected'] },
  actionRemarks: String,
  actionDate: Date,
  date: { type: Date, default: Date.now },
});

basePlugin(transferSchema);

module.exports = mongoose.model('Transfer', transferSchema);
