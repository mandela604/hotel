const mongoose = require('mongoose');

const poolbarMovementSchema = new mongoose.Schema({
  date:    { type: Date, default: Date.now },
  item:    { type: String, required: true },
  qtyIn:   { type: Number, default: 0 },
  qtyOut:  { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  reason:  { type: String, default: '' },
}, { timestamps: true });

/* listMovements: date-range filter + sort by date desc on every load. */
poolbarMovementSchema.index({ date: -1 });

module.exports = mongoose.model('PoolbarMovement', poolbarMovementSchema);
