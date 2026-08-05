/**
 * Grace Hotel — GymPlan Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const gymPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true, default: 0 },
  durationDays: { type: Number, required: true, default: 30 },
  durationMonths: { type: Number, default: 1 },
  description: String,
  benefits: String,
  features: [String],
  notes: String,
});

basePlugin(gymPlanSchema);

module.exports = mongoose.model('GymPlan', gymPlanSchema);