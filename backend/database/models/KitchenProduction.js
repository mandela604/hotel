/**
 * Grace Hotel — KitchenProduction Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const kitchenProductionSchema = new mongoose.Schema({
  items: [{ name: String, qty: Number, unit: String }],
  qty: { type: Number, default: 0 },
  unit: { type: String, default: 'plates' },
  department: String,
  chef: String,
  date: { type: Date, required: true },
  time: String,
  status: { type: String, default: 'planned', enum: ['planned','in_progress','completed','cancelled'] },
});

basePlugin(kitchenProductionSchema);

module.exports = mongoose.model('KitchenProduction', kitchenProductionSchema);