/**
 * Grace Hotel — AccountingTransaction Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const accountingTransactionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  ref: { type: String, required: true, unique: true, index: true },
  description: String,
  type: { type: String, required: true, enum: ['income','expense','transfer'] },
  amount: { type: Number, default: 0 },
  category: String,
  department: String,
  recordedById: String,
  notes: String,
});

basePlugin(accountingTransactionSchema);

module.exports = mongoose.model('AccountingTransaction', accountingTransactionSchema);