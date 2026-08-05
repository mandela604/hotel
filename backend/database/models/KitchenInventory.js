/**
 * Grace Hotel — KitchenInventory Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const kitchenInventorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  unit: { type: String, default: 'kg' },
  qty: { type: Number, default: 0 },
  reorder: { type: Number, default: 0 },
  costPerUnit: { type: Number, default: 0 },
  supplier: String,
});

basePlugin(kitchenInventorySchema);

module.exports = mongoose.model('KitchenInventory', kitchenInventorySchema);