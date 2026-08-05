/**
 * Grace Hotel — GymMember Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const gymMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  planId: { type: String, required: true },
  startDate: { type: Date, required: true, default: Date.now },
  endDate: { type: Date, required: true },
  status: { type: String, default: 'active', enum: ['active', 'expired', 'suspended', 'inactive'] },
  visits: { type: Number, default: 0 },
  checkins: { type: Number, default: 0 },
  lastCheckin: { type: Date, default: null },
  phone: String,
  email: String,
  notes: String,
  emergencyContact: String,
});

basePlugin(gymMemberSchema);

module.exports = mongoose.model('GymMember', gymMemberSchema);