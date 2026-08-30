const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  id:                   { type: String, required: true, unique: true },
  dish:                 { type: String, required: true, unique: true },
  baseQty:              { type: Number, default: 1 },
  baseUnit:             { type: String, default: 'kg' },
  baseIngredient:       { type: String, default: '' },
  ingredients:          [{ name: String, qty: Number, unit: String }],
  expectedYield:        { type: Number, default: 0 },
  expectedYieldUnit:    { type: String, default: 'plates' },
  gasCostPerUnit:       { type: Number, default: 0 },
  notes:                { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Recipe', recipeSchema);
