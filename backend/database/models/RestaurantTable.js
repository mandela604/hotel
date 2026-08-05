/**
 * Grace Hotel — Restaurant Table Model
 */

const mongoose = require('mongoose');
const { basePlugin } = require('./base');

const restaurantTableSchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true, unique: true },
  seats: { type: Number, default: 2 },
  section: String,
  status: { type: String, default: 'available', enum: ['available','occupied','reserved','cleaning'] },
});

basePlugin(restaurantTableSchema);

module.exports = mongoose.model('RestaurantTable', restaurantTableSchema);