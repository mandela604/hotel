/**
 * Grace Hotel — GymCheckin Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const gymCheckinSchema = new mongoose.Schema({
  memberId: { type: String, required: true },
  memberName: String,
  date: { type: Date, required: true },
  time: { type: String, required: true },
});

basePlugin(gymCheckinSchema);

module.exports = mongoose.model('GymCheckin', gymCheckinSchema);