const mongoose = require('mongoose');

const incomeEntrySchema = new mongoose.Schema({
  date:        { type: Date, default: Date.now },
  description: { type: String, default: '' },
  category:    { type: String, default: '' },
  amount:      { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('IncomeEntry', incomeEntrySchema);
