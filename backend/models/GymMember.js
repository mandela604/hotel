const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    mode: { type: String, enum: ['Cash', 'POS', 'Transfer', 'Room Charge'], required: true },
    by: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    ts: { type: Number, required: true },
    roomNumber: { type: String, default: null },
    guestName: { type: String, default: null },
    guestPhone: { type: String, default: null },
  },
  { _id: false }
);

const gymMemberSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    planId: { type: String, ref: 'GymPlan', default: null },
    room: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    joined: { type: String, required: true },
    expiry: { type: String, default: '' },
    notes: { type: String, default: '', trim: true },
    status: { type: String, enum: ['active', 'frozen'], default: 'active' },
    checkins: { type: Number, default: 0, min: 0 },
    lastCheckin: { type: String, default: null },
    totalDue: { type: Number, default: 0, min: 0 },
    payments: { type: [paymentSchema], default: [] },
  },
  { timestamps: true, _id: false }
);

module.exports = mongoose.model('GymMember', gymMemberSchema);