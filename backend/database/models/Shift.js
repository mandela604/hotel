/**
 * Grace Hotel — Shift Model (Accounting Shift Reconciliation)
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const shiftLogSchema = new mongoose.Schema({
  actor: { type: String, required: true },
  actualCash: { type: Number, required: true },
  expected: { type: Number, required: true },
  variance: { type: Number, required: true },
  notes: String,
  type: { type: String, enum: ['initial', 'correction'], default: 'initial' },
  date: { type: Date, default: Date.now },
});

const shiftSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true }, // e.g. "2026-07-17"
  staff: { type: String, required: true },
  openingFloat: { type: Number, default: 50000 },
  actualCash: { type: Number, default: null },
  status: { type: String, default: 'open', enum: ['open', 'reconciled'] },
  notes: String,
  history: [shiftLogSchema],
});

basePlugin(shiftSchema);

module.exports = mongoose.model('Shift', shiftSchema);
