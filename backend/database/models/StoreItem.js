/**
 * Grace Hotel — StoreItem Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const storeItemSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  unit: { type: String, default: 'kg' },
  stock: { type: Number, default: 0 },
  reorder: { type: Number, default: 0 },
  pricePerUnit: { type: Number, default: 0 },
  category: String,
  supplier: String,
});

basePlugin(storeItemSchema);

module.exports = mongoose.model('StoreItem', storeItemSchema);