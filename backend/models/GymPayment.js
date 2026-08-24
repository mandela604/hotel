/**
 * NOTE: model not yet supplied — created here because gym-revenue.html's
 * GymService.getRevenueReport(from, to) needs a payment history to
 * aggregate (paymentsCount, totalRevenue, revenueByPlan, payments[]) and
 * nothing in GymMember/GymPlan/GymCheckin stores that. A payment record
 * is created whenever a membership is sold (addMember) or renewed
 * (renewMember), priced off the plan at that moment.
 */
const mongoose = require('mongoose');

const gymPaymentSchema = new mongoose.Schema({
  member:     { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember', required: true },
  memberName: { type: String, required: true },
  plan:       { type: mongoose.Schema.Types.ObjectId, ref: 'GymPlan' },
  planName:   { type: String, default: '' },
  amount:     { type: Number, required: true },
  type:       { type: String, enum: ['new', 'renewal'], default: 'new' },
  method:     { type: String, enum: ['cash', 'charge'], default: 'cash' },
  // Set only when method === 'charge' — the in-house guest this
  // membership fee was posted to (mirrors the Restaurant Room Charge flow).
  guestId:    { type: String, default: '' },
  guestRoom:  { type: String, default: '' },
  recordedBy: { type: String, default: '' },
  date:       { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('GymPayment', gymPaymentSchema);