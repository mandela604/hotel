const mongoose = require('mongoose');

const kitchenStockSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  category:     { type: String, default: '' },
  unit:         { type: String, default: 'kg' },
  qty:          { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 10 },
  cost:         { type: Number, default: 0 },
  batch:        { type: String, default: '' },
  received:     { type: String, default: '' },
  desc:         { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('KitchenStock', kitchenStockSchema);
