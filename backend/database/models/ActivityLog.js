/**
 * Grace Hotel — ActivityLog Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const activityLogSchema = new mongoose.Schema({
  department: { type: String, required: true },
  action: { type: String, required: true },
  description: String,
  userId: String,
  userName: String,
  color: { type: String, default: 'gold' },
  href: String,
});

basePlugin(activityLogSchema);

module.exports = mongoose.model('ActivityLog', activityLogSchema);