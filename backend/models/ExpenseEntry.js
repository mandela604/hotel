const mongoose = require('mongoose');

const expenseEntrySchema = new mongoose.Schema({
  date:        { type: Date, default: Date.now },
  description: { type: String, default: '' },
  category:    { type: String, default: '' },
  amount:      { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ExpenseEntry', expenseEntrySchema);
