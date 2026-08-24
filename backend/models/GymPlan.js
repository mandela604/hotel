const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const gymPlanSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    price: { type: Number, required: true, default: 0, min: 0 },
    durationDays: { type: Number, required: true, default: 30, min: 1 },
    notes: { type: String, default: '', trim: true },
    color: { type: String, enum: ['gold', 'blue', 'purple', 'green', 'amber'], default: 'blue' },
  },
  { timestamps: true, _id: false }
);

module.exports = mongoose.model('GymPlan', gymPlanSchema);