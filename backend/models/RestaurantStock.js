/**
 * NOTE: model not yet supplied — created here, mirroring KitchenStock's
 * shape/conventions, because restaurant-inventory.html needs its own stock
 * collection independent of KitchenStock ("Everything sellable — food and
 * bar, independent of Kitchen stock" — restaurant-menu.html page subtitle).
 *
 * qty is intentionally never edited directly by the Add/Edit Item form
 * (see the "Qty on hand is set by transfers & sales — not edited here"
 * hint in restaurant-inventory.html) — it only moves via acceptTransfer
 * (+) and sale creation/void (-/+).
 */
const mongoose = require('mongoose');

const restaurantStockSchema = new mongoose.Schema({
  name:     { type: String, required: true, unique: true, trim: true },
  category: { type: String, default: 'Uncategorized', trim: true },
  unit:     { type: String, default: 'portion', trim: true },
  storeId:  { type: String, default: '', index: true },
  qty:      { type: Number, default: 0 },
  min:      { type: Number, default: 0 },
  price:    { type: Number, default: 0 },
  cost:     { type: Number, default: 0 },
  desc:     { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('RestaurantStock', restaurantStockSchema);