/**
 * Grace Hotel — Menu Item Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
  category: { type: String, required: true },
  department: { type: String, required: true, enum: ['restaurant','poolbar','both'] },
  description: String,
  available: { type: Boolean, default: true },
});

basePlugin(menuItemSchema);

module.exports = mongoose.model('MenuItem', menuItemSchema);