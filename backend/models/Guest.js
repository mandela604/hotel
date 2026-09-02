/**
 * Guest model with explicit string `id` (uuidv4) for public-facing
 * identification. Charge subdocuments also carry their own `id` field.
 * Never read/write MongoDB `_id` as a public identifier — always use `id`.
 */
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const staySchema = new mongoose.Schema({
  room:     { type: String, default: '' },
  type:     { type: String, default: '' },
  checkin:  { type: String, default: '' },
  checkout: { type: String, default: '' },
  total:    { type: Number, default: 0 },
  paid:     { type: Number, default: 0 },
  status:   { type: String, default: '' },
}, { _id: false });

const chargePaymentSchema = new mongoose.Schema({
  id:     { type: String, required: true },
  amount: { type: Number, required: true },
  mode:   { type: String, default: 'Cash' },
  date:   { type: String, default: '' },
  by:     { type: String, default: '' },
  ts:     { type: Number, default: 0 },
}, { _id: false });

const chargeSchema = new mongoose.Schema({
  id:         { type: String, default: uuidv4 },
  bookingRef: { type: String, default: '' },
  date:       { type: String, default: '' },
  source:     { type: String, default: 'Other' },
  desc:       { type: String, default: '' },
  room:       { type: String, default: '' },
  amount:     { type: Number, default: 0 },
  paid:       { type: Number, default: 0 },
  by:         { type: String, default: '' },
  status:     { type: String, enum: ['Pending', 'Partially Settled', 'Settled'], default: 'Pending' },
  payments:   { type: [chargePaymentSchema], default: [] },
}, { _id: false });

const guestSchema = new mongoose.Schema({
  id:       { type: String, default: uuidv4, index: true, unique: true },
  guestId:  { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  phone:    { type: String, default: '' },
  email:    { type: String, default: '' },
  address:  { type: String, default: '' },
  idType:   { type: String, default: 'NIN' },
  idNum:    { type: String, default: '' },
  vip:      { type: Boolean, default: false },
  notes:    { type: String, default: '' },
  stays:    { type: [staySchema], default: [] },
  charges:  { type: [chargeSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Guest', guestSchema);