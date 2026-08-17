const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  date:        { type: Date, default: Date.now },
  ref:         { type: String, default: '' },
  description: { type: String, default: '' },
  type:        { type: String, enum: ['income','expense'], required: true },
  amount:      { type: Number, default: 0 },
  department:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
