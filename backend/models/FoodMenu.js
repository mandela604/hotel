const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * FoodMenu — ONE shared food menu for restaurant + poolbar.
 * Entered once, sold in both departments as normal quick sale / open tab.
 * Food items carry no stock: sales skip stock validation/deduction.
 * recipeId is reserved for the future kitchen system — when CoO is
 * unhidden, a food item can be linked to a real kitchen recipe and the
 * isFood bypass can be disabled/removed without touching sales history.
 */
const foodMenuSchema = new mongoose.Schema({
  id:        { type: String, default: uuidv4, unique: true, index: true },
  name:      { type: String, required: true, unique: true, trim: true },
  price:     { type: Number, required: true },
  category:  { type: String, default: 'Main' },
  available: { type: Boolean, default: true },
  recipeId:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('FoodMenu', foodMenuSchema);
