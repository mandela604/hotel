const mongoose = require('mongoose');

const storeItemSchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true },
  category:     { type: String, default: 'Other' },
  unit:         { type: String, default: 'Pieces' },
  qty:          { type: Number, default: 0 },
  cost:         { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 10 },
}, { timestamps: true });

module.exports = mongoose.model('StoreItem', storeItemSchema);
