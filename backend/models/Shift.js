const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  dept:          { type: String, required: true },
  staff:         { type: String, default: '' },
  date:          { type: Date, default: Date.now },
  openingFloat:  { type: Number, default: 0 },
  status:        { type: String, enum: ['open','reconciled'], default: 'open' },
  actualCash:    { type: Number, default: 0 },
  expectedCash:  { type: Number, default: 0 },
  variance:      { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Shift', shiftSchema);
