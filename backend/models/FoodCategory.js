const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * FoodCategory — categories for the shared FoodMenu (restaurant + poolbar).
 * Own collection with uuidv4 ids so rename/delete cascade cleanly onto
 * FoodMenu items without touching stock/inventory categories.
 */
const foodCategorySchema = new mongoose.Schema({
  id:   { type: String, default: uuidv4, unique: true, index: true },
  name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
}, { timestamps: true });

module.exports = mongoose.model('FoodCategory', foodCategorySchema);
