const mongoose = require('mongoose');

const kitchenMovementSchema = new mongoose.Schema({
  date:    { type: Date, default: Date.now },
  item:    { type: String, required: true },
  qtyIn:   { type: Number, default: 0 },
  qtyOut:  { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  reason:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('KitchenMovement', kitchenMovementSchema);
