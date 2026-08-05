/**
 * Grace Hotel — Payment Model (Gym Payments & Subscriptions)
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const paymentSchema = new mongoose.Schema({
  memberId: { type: String, required: true },
  memberName: String,
  planId: String,
  planName: String,
  amount: { type: Number, required: true },
  method: { type: String, default: 'Cash', enum: ['Cash', 'Card', 'Transfer', 'POS'] },
  date: { type: Date, default: Date.now },
  ref: { type: String, unique: true },
  notes: String,
});

basePlugin(paymentSchema);

module.exports = mongoose.model('Payment', paymentSchema);
