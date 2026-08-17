const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  category:     { type: String, default: 'General' },
  contactPerson:{ type: String, default: '' },
  phone:        { type: String, default: '' },
  email:        { type: String, default: '' },
  rating:       { type: Number, default: 0, min: 0, max: 5 },
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
