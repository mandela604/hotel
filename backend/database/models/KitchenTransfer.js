/**
 * Grace Hotel — KitchenTransfer Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const kitchenTransferSchema = new mongoose.Schema({
  fromLocation: { type: String, required: true },
  toLocation: { type: String, required: true },
  items: mongoose.Schema.Types.Mixed,
  date: { type: Date, required: true },
  byName: String,
  status: { type: String, default: 'pending', enum: ['pending','completed','cancelled'] },
});

basePlugin(kitchenTransferSchema);

module.exports = mongoose.model('KitchenTransfer', kitchenTransferSchema);