const mongoose = require('mongoose');

const expenseEntrySchema = new mongoose.Schema({
  date:        { type: Date, default: Date.now },
  category:    { type: String, default: '' },
  description: { type: String, default: '' },
  amount:      { type: Number, default: 0 },
  recordedBy:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ExpenseEntry', expenseEntrySchema);
