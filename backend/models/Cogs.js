const mongoose = require('mongoose');

const cogsSchema = new mongoose.Schema({
  id:         { type: String, required: true, unique: true, index: true },
  dept:       { type: String, enum: ['kitchen', 'restaurant', 'poolbar'], required: true, index: true },
  item:       { type: String, default: '' },
  qty:        { type: Number, default: 0 },
  unitCost:   { type: Number, default: 0 },
  amount:     { type: Number, default: 0 },
  date:       { type: String, default: '' },
  source:     { type: String, default: 'deductStock' },
  by:         { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Cogs', cogsSchema);
