const mongoose = require('mongoose');

/**
 * StoreMovement — audit ledger for Central Store stock.
 * Logged henceforth on every qty change (receive, issue, adjust, add,
 * manual update) so the Daily Stock Sheet can derive opening/added/
 * closing per item per day, mirroring the outlet movement ledgers.
 */
const storeMovementSchema = new mongoose.Schema({
  date:    { type: String, default: '' },
  item:    { type: String, required: true },
  qtyIn:   { type: Number, default: 0 },
  qtyOut:  { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  reason:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('StoreMovement', storeMovementSchema);
