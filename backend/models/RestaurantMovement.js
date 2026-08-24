/**
 * NOTE: model not yet supplied — mirrors KitchenMovement exactly, scoped
 * to RestaurantStock instead of KitchenStock. Powers a movements/audit
 * log for restaurant stock (transfer-in, sale-out, void-restore, manual edits).
 */
const mongoose = require('mongoose');

const restaurantMovementSchema = new mongoose.Schema({
  date:    { type: Date, default: Date.now },
  item:    { type: String, required: true },
  qtyIn:   { type: Number, default: 0 },
  qtyOut:  { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  reason:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('RestaurantMovement', restaurantMovementSchema);