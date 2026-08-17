const mongoose = require('mongoose');

const gymPlanSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  price:        { type: Number, required: true },
  durationDays: { type: Number, required: true },
  notes:        { type: String, default: '' },
  color:        { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('GymPlan', gymPlanSchema);
