const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const menuItemSchema = new mongoose.Schema({
  id:         { type: String, default: uuidv4, unique: true, index: true },
  name:       { type: String, required: true },
  price:      { type: Number, required: true },
  category:   { type: String, default: 'Main' },
  department: { type: String, enum: ['restaurant','poolbar'], required: true },
  available:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
